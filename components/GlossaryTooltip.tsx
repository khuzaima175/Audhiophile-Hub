import React, { useState, useRef, useEffect } from 'react';

// Audiophile Glossary Database
export const AUDIOPHILE_GLOSSARY: Record<string, { term: string; definition: string; example?: string }> = {
    // Sound Signature Terms
    'soundstage': {
        term: 'Soundstage',
        definition: 'The perceived 3D space created by audio playback. A wide soundstage makes instruments feel spread out left-to-right and front-to-back.',
        example: 'Open-back headphones typically have a larger soundstage than IEMs.'
    },
    'imaging': {
        term: 'Imaging',
        definition: 'The ability to pinpoint exact locations of instruments and sounds within the soundstage. Good imaging = precise positioning.',
        example: 'In gaming, good imaging helps you locate footsteps accurately.'
    },
    'separation': {
        term: 'Separation',
        definition: 'How distinctly different instruments and sounds are kept apart from each other. Poor separation = muddy, congested sound.',
    },
    'sibilance': {
        term: 'Sibilance',
        definition: 'Harsh, hissing "S" and "T" sounds, usually caused by peaks around 6-10kHz. Often described as fatiguing.',
        example: 'Some IEMs with boosted treble can sound sibilant on vocal tracks.'
    },
    'timbre': {
        term: 'Timbre',
        definition: 'The "color" or "character" of sound that makes a piano sound different from a guitar at the same pitch. Natural timbre = realistic instrument textures.',
    },
    'decay': {
        term: 'Decay',
        definition: 'How long a sound takes to fade away after the initial attack. Natural decay gives music "soul" and realism.',
    },
    'transient': {
        term: 'Transient',
        definition: 'The initial sharp attack of a sound (like a drum hit or pluck). Fast transients = snappy, detailed sound.',
    },
    'roll-off': {
        term: 'Roll-off',
        definition: 'Gradual reduction in frequency response at the extremes (sub-bass or treble). A treble roll-off makes sound less fatiguing.',
    },
    // Frequency Terms
    'sub-bass': {
        term: 'Sub-bass',
        definition: 'The lowest frequencies (20-60Hz). Felt more than heard - the deep rumble in movie explosions and electronic music.',
    },
    'mid-bass': {
        term: 'Mid-bass',
        definition: 'Frequencies around 100-250Hz. Adds punch and warmth, but too much causes "bloat" or muddiness.',
    },
    'bloat': {
        term: 'Bloat',
        definition: 'Excessive mid-bass that bleeds into other frequencies, making the sound muddy and lacking definition.',
    },
    'treble': {
        term: 'Treble',
        definition: 'High frequencies (2kHz-20kHz). Responsible for detail, air, and sparkle. Too much = bright/harsh.',
    },
    'mids': {
        term: 'Mids',
        definition: 'Mid-range frequencies (250Hz-2kHz). The heart of music - vocals and most instruments live here.',
    },
    // Technical Terms
    'thd': {
        term: 'THD (Total Harmonic Distortion)',
        definition: 'Measurement of signal distortion. Lower is better. Under 1% is generally inaudible.',
    },
    'impedance': {
        term: 'Impedance',
        definition: 'Electrical resistance measured in Ohms (Ω). High impedance headphones need more power to drive properly.',
        example: '300Ω headphones like the HD600 need a proper amp.'
    },
    'sensitivity': {
        term: 'Sensitivity',
        definition: 'How loud a headphone gets per unit of power (dB/mW). Higher sensitivity = easier to drive.',
    },
    'dac': {
        term: 'DAC (Digital-to-Analog Converter)',
        definition: 'Converts digital audio files to analog signals your headphones can play. Better DAC = cleaner signal.',
    },
    'amp': {
        term: 'AMP (Amplifier)',
        definition: 'Boosts the audio signal to drive headphones. Essential for high-impedance or low-sensitivity cans.',
    },
    'iem': {
        term: 'IEM (In-Ear Monitor)',
        definition: 'Earphones that insert into the ear canal with a seal. Used by musicians and audiophiles.',
    },
    // Target Curves
    'harman': {
        term: 'Harman Target',
        definition: 'A frequency response curve developed by Harman International that most listeners prefer. Slightly bass-boosted with smooth treble.',
    },
    'diffuse field': {
        term: 'Diffuse Field',
        definition: 'A neutral target curve based on how speakers sound in an anechoic chamber. Often sounds bright/thin to most listeners.',
    },
    // Driver Types
    'dynamic driver': {
        term: 'Dynamic Driver',
        definition: 'Traditional cone-shaped driver. Good bass impact and natural timbre, but can struggle with treble detail.',
    },
    'balanced armature': {
        term: 'Balanced Armature (BA)',
        definition: 'Tiny precision drivers often used for mids/treble. Fast and detailed but can sound "clinical."',
    },
    'planar': {
        term: 'Planar Magnetic',
        definition: 'Flat diaphragm with embedded conductors. Known for excellent detail, speed, and unique "slam."',
    },
    'tribrid': {
        term: 'Tribrid',
        definition: 'IEM using 3 different driver types (e.g., DD for bass, BA for mids, EST for treble).',
    },
    'est': {
        term: 'EST (Electrostatic)',
        definition: 'Ultra-thin drivers for extremely detailed treble. Often used in tribrid IEMs.',
    }
};

// Get all glossary terms for matching
export const GLOSSARY_TERMS = Object.keys(AUDIOPHILE_GLOSSARY);

// Create regex pattern for matching (case insensitive, whole words)
const createTermPattern = () => {
    const escapedTerms = GLOSSARY_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');
};

interface GlossaryTooltipProps {
    term: string;
    children: React.ReactNode;
}

export const GlossaryTooltip: React.FC<GlossaryTooltipProps> = ({ term, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState<'top' | 'bottom'>('top');
    const tooltipRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);

    const entry = AUDIOPHILE_GLOSSARY[term.toLowerCase()];
    if (!entry) return <>{children}</>;

    useEffect(() => {
        if (isVisible && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // If too close to top, show below
            setPosition(rect.top < 150 ? 'bottom' : 'top');
        }
    }, [isVisible]);

    return (
        <span className="relative inline-block">
            <span
                ref={triggerRef}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                className="border-b border-dashed border-audio-accent/50 text-audio-accent cursor-help hover:border-audio-accent transition-colors"
            >
                {children}
            </span>

            {isVisible && (
                <div
                    ref={tooltipRef}
                    className={`absolute z-50 w-72 p-3.5 bg-audio-surface border border-audio-border rounded-xl shadow-panel animate-in fade-in zoom-in-95 duration-150 ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                        } left-1/2 -translate-x-1/2`}
                >
                    {/* Arrow */}
                    <div
                        className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-audio-surface border-audio-border rotate-45 ${position === 'top'
                                ? 'bottom-[-5px] border-r border-b'
                                : 'top-[-5px] border-l border-t'
                            }`}
                    />

                    <div className="relative">
                        <h4 className="text-xs font-semibold text-audio-accent uppercase tracking-wider mb-1 font-data">
                            {entry.term}
                        </h4>
                        <p className="text-xs text-audio-text/90 leading-relaxed">
                            {entry.definition}
                        </p>
                        {entry.example && (
                            <p className="text-[10px] text-audio-muted mt-2 italic font-data">
                                💡 {entry.example}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </span>
    );
};

// Utility function to wrap glossary terms in a text string
export const highlightGlossaryTerms = (text: string): React.ReactNode[] => {
    const pattern = createTermPattern();
    const parts = text.split(pattern);

    return parts.map((part, index) => {
        const lowerPart = part.toLowerCase();
        if (AUDIOPHILE_GLOSSARY[lowerPart]) {
            return (
                <GlossaryTooltip key={index} term={lowerPart}>
                    {part}
                </GlossaryTooltip>
            );
        }
        return part;
    });
};

export default GlossaryTooltip;
