import { PEQFilter, StereoFilters } from '../types';
import { createDSPNode } from './biquad';
import { effectivePreamp } from './audioPolicy';
export function stereoPreamp(filters: StereoFilters, mode:'automatic'|'manual', requested:number, rate:number) {
  return Math.min(effectivePreamp(filters.left,mode,requested,rate),effectivePreamp(filters.right,mode,requested,rate));
}
export function validateStereoFilters(value: unknown): value is StereoFilters {
  if(!value || typeof value !== 'object')return false;
  const banks=value as StereoFilters;
  return [banks.left,banks.right].every(bank=>Array.isArray(bank)&&bank.every(f=>!!f&&typeof f==='object')&&new Set(bank.map(f=>f.id)).size===bank.length&&bank.every(f=>typeof f.id==='string'&&['PK','LS','HS','HP','LP','NOTCH'].includes(f.type)&&Number.isFinite(f.freq)&&f.freq>=20&&f.freq<=20000&&Number.isFinite(f.gain)&&Math.abs(f.gain)<=36&&Number.isFinite(f.q)&&f.q>=.1&&f.q<=20&&(f.enabled===undefined||typeof f.enabled==='boolean')));
}
/** Upmix mono to stereo, apply independent banks, and preserve channel ordering. */
export function createStereoChain(ctx: BaseAudioContext, input: AudioNode, filters: StereoFilters): {output:AudioNode;nodes:AudioNode[]} {
  const upmix=ctx.createGain();upmix.channelCount=2;upmix.channelCountMode='explicit';upmix.channelInterpretation='speakers';
  const splitter=ctx.createChannelSplitter(2), merger=ctx.createChannelMerger(2);
  input.connect(upmix);upmix.connect(splitter);
  const nodes:AudioNode[]=[upmix,splitter,merger];
  [filters.left,filters.right].forEach((bank,index)=>{
    let tail:AudioNode=splitter;
    for(const f of bank.filter(f=>f.enabled!==false)) {
      const node=createDSPNode(ctx as AudioContext,f);
      tail.connect(node,tail===splitter?index:0);tail=node;nodes.push(node);
    }
    tail.connect(merger,tail===splitter?index:0,index);
  });
  return {output:merger,nodes};
}
