'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { gsap } from 'gsap';
import { IconBox } from './BentoMiniComponents';
import './MagicBento.css';

const DEFAULT_PARTICLE_COUNT = 12;
const DEFAULT_SPOTLIGHT_RADIUS = 300;
const DEFAULT_GLOW_COLOR = '98, 31, 50';
const MOBILE_BREAKPOINT = 768;

/* ── Particle / Spotlight infrastructure (sin cambios) ───── */

const createParticleElement = (x, y, color = DEFAULT_GLOW_COLOR) => {
    const el = document.createElement('div');
    el.className = 'particle';
    el.style.cssText = `
        position:absolute;width:3px;height:3px;border-radius:50%;
        background:rgba(${color},0.8);box-shadow:0 0 6px rgba(${color},0.6);
        pointer-events:none;z-index:100;left:${x}px;top:${y}px;
    `;
    return el;
};

const calculateSpotlightValues = radius => ({
    proximity: radius * 0.5,
    fadeDistance: radius * 0.75
});

const updateCardGlowProperties = (card, mouseX, mouseY, glow, radius) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--glow-x', `${((mouseX - rect.left) / rect.width) * 100}%`);
    card.style.setProperty('--glow-y', `${((mouseY - rect.top) / rect.height) * 100}%`);
    card.style.setProperty('--glow-intensity', glow.toString());
    card.style.setProperty('--glow-radius', `${radius}px`);
};

const ParticleCard = ({
    children, className = '', disableAnimations = false, style,
    particleCount = DEFAULT_PARTICLE_COUNT, glowColor = DEFAULT_GLOW_COLOR,
    enableTilt = true, clickEffect = false, enableMagnetism = false,
    onClickRedirectTo,
}) => {
    const cardRef = useRef(null);
    const particlesRef = useRef([]);
    const timeoutsRef = useRef([]);
    const isHoveredRef = useRef(false);
    const memoizedParticles = useRef([]);
    const particlesInitialized = useRef(false);
    const magnetismAnimationRef = useRef(null);



    const redirectTo = (url) => {
        window.location.href = url;
    }

    const initializeParticles = useCallback(() => {
        if (particlesInitialized.current || !cardRef.current) return;
        const { width, height } = cardRef.current.getBoundingClientRect();
        memoizedParticles.current = Array.from({ length: particleCount }, () =>
            createParticleElement(Math.random() * width, Math.random() * height, glowColor)
        );
        particlesInitialized.current = true;
    }, [particleCount, glowColor]);

    const clearAllParticles = useCallback(() => {
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];
        magnetismAnimationRef.current?.kill();
        particlesRef.current.forEach(particle => {
            gsap.to(particle, {
                scale: 0, opacity: 0, duration: 0.3, ease: 'back.in(1.7)',
                onComplete: () => particle.parentNode?.removeChild(particle)
            });
        });
        particlesRef.current = [];
    }, []);

    const animateParticles = useCallback(() => {
        if (!cardRef.current || !isHoveredRef.current) return;
        if (!particlesInitialized.current) initializeParticles();
        memoizedParticles.current.forEach((particle, index) => {
            const timeoutId = setTimeout(() => {
                if (!isHoveredRef.current || !cardRef.current) return;
                const clone = particle.cloneNode(true);
                cardRef.current.appendChild(clone);
                particlesRef.current.push(clone);
                gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' });
                gsap.to(clone, { x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80, rotation: Math.random() * 360, duration: 3 + Math.random() * 2, ease: 'none', repeat: -1, yoyo: true });
                gsap.to(clone, { opacity: 0.2, duration: 1.5, ease: 'power2.inOut', repeat: -1, yoyo: true });
            }, index * 100);
            timeoutsRef.current.push(timeoutId);
        });
    }, [initializeParticles]);

    useEffect(() => {
        if (disableAnimations || !cardRef.current) return;
        const element = cardRef.current;

        const handleMouseEnter = () => {
            isHoveredRef.current = true;
            animateParticles();
            if (enableTilt) gsap.to(element, { rotateX: 4, rotateY: 4, duration: 0.3, ease: 'power2.out', transformPerspective: 1000 });
        };
        const handleMouseLeave = () => {
            isHoveredRef.current = false;
            clearAllParticles();
            if (enableTilt) gsap.to(element, { rotateX: 0, rotateY: 0, duration: 0.3, ease: 'power2.out' });
            if (enableMagnetism) gsap.to(element, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' });
        };
        const handleMouseMove = e => {
            if (!enableTilt && !enableMagnetism) return;
            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            const centerX = rect.width / 2, centerY = rect.height / 2;
            if (enableTilt) gsap.to(element, { rotateX: ((y - centerY) / centerY) * -8, rotateY: ((x - centerX) / centerX) * 8, duration: 0.1, ease: 'power2.out', transformPerspective: 1000 });
            if (enableMagnetism) { magnetismAnimationRef.current = gsap.to(element, { x: (x - centerX) * 0.04, y: (y - centerY) * 0.04, duration: 0.3, ease: 'power2.out' }); }
        };
        const handleClick = e => {
            if (!clickEffect) return;
            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            const maxDistance = Math.max(Math.hypot(x, y), Math.hypot(x - rect.width, y), Math.hypot(x, y - rect.height), Math.hypot(x - rect.width, y - rect.height));
            const ripple = document.createElement('div');
            ripple.style.cssText = `position:absolute;width:${maxDistance * 2}px;height:${maxDistance * 2}px;border-radius:50%;background:radial-gradient(circle,rgba(${glowColor},0.3) 0%,rgba(${glowColor},0.1) 30%,transparent 70%);left:${x - maxDistance}px;top:${y - maxDistance}px;pointer-events:none;z-index:1000;`;
            element.appendChild(ripple);
            gsap.fromTo(ripple, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => ripple.remove() });
        };

        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mouseleave', handleMouseLeave);
        element.addEventListener('mousemove', handleMouseMove);
        element.addEventListener('click', handleClick);
        return () => {
            isHoveredRef.current = false;
            element.removeEventListener('mouseenter', handleMouseEnter);
            element.removeEventListener('mouseleave', handleMouseLeave);
            element.removeEventListener('mousemove', handleMouseMove);
            element.removeEventListener('click', handleClick);
            clearAllParticles();
        };
    }, [animateParticles, clearAllParticles, disableAnimations, enableTilt, enableMagnetism, clickEffect, glowColor]);

    return (
        <div
            ref={cardRef}
            role={onClickRedirectTo ? "link" : undefined}
            tabIndex={onClickRedirectTo ? 0 : undefined}
            onClick={onClickRedirectTo ? () => redirectTo(onClickRedirectTo) : undefined}
            onKeyDown={onClickRedirectTo ? (e) => { if (e.key === 'Enter' || e.key === ' ') redirectTo(onClickRedirectTo); } : undefined}
            className={`${className} particle-container`}
            style={{ ...style, position: 'relative', overflow: 'hidden' }}
        >
            {children}
        </div>
    );
};

const GlobalSpotlight = ({ gridRef, disableAnimations = false, enabled = true, spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS, glowColor = DEFAULT_GLOW_COLOR }) => {
    const spotlightRef = useRef(null);

    useEffect(() => {
        if (disableAnimations || !gridRef?.current || !enabled) return;
        const spotlight = document.createElement('div');
        spotlight.className = 'global-spotlight';
        spotlight.style.cssText = `position:fixed;width:800px;height:800px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(${glowColor},0.08) 0%,rgba(${glowColor},0.04) 15%,rgba(${glowColor},0.02) 25%,transparent 70%);z-index:200;opacity:0;transform:translate(-50%,-50%);mix-blend-mode:screen;`;
        document.body.appendChild(spotlight);
        spotlightRef.current = spotlight;

        const handleMouseMove = e => {
            if (!spotlightRef.current || !gridRef.current) return;
            const section = gridRef.current.closest('.bento-section');
            const rect = section?.getBoundingClientRect();
            const mouseInside = rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
            const cards = gridRef.current.querySelectorAll('.magic-bento-card');
            if (!mouseInside) {
                gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' });
                cards.forEach(card => card.style.setProperty('--glow-intensity', '0'));
                return;
            }
            const { proximity, fadeDistance } = calculateSpotlightValues(spotlightRadius);
            let minDistance = Infinity;
            cards.forEach(card => {
                const cardRect = card.getBoundingClientRect();
                const centerX = cardRect.left + cardRect.width / 2, centerY = cardRect.top + cardRect.height / 2;
                const effectiveDistance = Math.max(0, Math.hypot(e.clientX - centerX, e.clientY - centerY) - Math.max(cardRect.width, cardRect.height) / 2);
                minDistance = Math.min(minDistance, effectiveDistance);
                let glowIntensity = 0;
                if (effectiveDistance <= proximity) glowIntensity = 1;
                else if (effectiveDistance <= fadeDistance) glowIntensity = (fadeDistance - effectiveDistance) / (fadeDistance - proximity);
                updateCardGlowProperties(card, e.clientX, e.clientY, glowIntensity, spotlightRadius);
            });
            gsap.to(spotlightRef.current, { left: e.clientX, top: e.clientY, duration: 0.1, ease: 'power2.out' });
            const targetOpacity = minDistance <= proximity ? 1 : minDistance <= fadeDistance ? (fadeDistance - minDistance) / (fadeDistance - proximity) : 0;
            gsap.to(spotlightRef.current, { opacity: targetOpacity, duration: targetOpacity > 0 ? 0.2 : 0.5, ease: 'power2.out' });
        };
        const handleMouseLeave = () => {
            gridRef.current?.querySelectorAll('.magic-bento-card').forEach(card => card.style.setProperty('--glow-intensity', '0'));
            if (spotlightRef.current) gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' });
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            spotlightRef.current?.parentNode?.removeChild(spotlightRef.current);
        };
    }, [gridRef, disableAnimations, enabled, spotlightRadius, glowColor]);

    return null;
};

const BentoCardGrid = ({ children, gridRef }) => (
    <div className="card-grid bento-section" ref={gridRef}>{children}</div>
);

const useMobileDetection = () => {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    return isMobile;
};

/* ── Card inner renderer ────────────────────────────────── */

function CardInner({ card }) {
    if (card.fullContent) {
        const content = card.renderContent ? card.renderContent() : card.children;
        if (card.onClickRedirectTo) {
            return (
                <div style={{ position: 'relative', height: '100%', width: '100%' }} className="tabular-nums">
                    {content}
                    <div className="absolute top-3 left-16 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 backdrop-blur-md shadow-sm border border-gray-100 text-[#621f32] font-black text-lg z-10 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                        ↗
                    </div>
                </div>
            );
        }
        return <div className="tabular-nums w-full h-full">{content}</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} className="tabular-nums relative">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {card.onClickRedirectTo && (
                        <div className="text-[#bc955c] font-black text-xl transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                            ↗
                        </div>
                    )}
                    <IconBox icon={card.icon} color={card.iconColor} bg={card.iconBg} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                        fontSize: 9, fontWeight: 800, padding: '4px 10px', borderRadius: 99,
                        background: 'rgba(98,31,50,0.07)', color: '#621f32',
                        textTransform: 'uppercase', letterSpacing: '0.1em'
                    }}>
                        {card.label}
                    </span>
                </div>
            </div>
            <div style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.3 }}>
                    {card.title}
                </h2>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '3px 0 0', lineHeight: 1.4 }}>
                    {card.description}
                </p>
            </div>
            {card.renderContent ? card.renderContent() : card.children}
        </div>
    );
}

/* ── Main Component ─────────────────────────────────────── */

const MagicBento = ({
    cards = [],
    textAutoHide = true,
    enableStars = true,
    enableSpotlight = true,
    enableBorderGlow = true,
    disableAnimations = false,
    spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
    particleCount = DEFAULT_PARTICLE_COUNT,
    enableTilt = true,
    glowColor = DEFAULT_GLOW_COLOR,
    clickEffect = true,
    enableMagnetism = true
}) => {
    const gridRef = useRef(null);
    const isMobile = useMobileDetection();
    const shouldDisableAnimations = disableAnimations || isMobile;

    const redirectTo = (url) => {
        window.location.href = url;
    }

    return (
        <div className="w-full flex justify-center">
            {enableSpotlight && (
                <GlobalSpotlight
                    gridRef={gridRef}
                    disableAnimations={shouldDisableAnimations}
                    enabled={enableSpotlight}
                    spotlightRadius={spotlightRadius}
                    glowColor={glowColor}
                />
            )}
            <BentoCardGrid gridRef={gridRef}>
                {cards.map((card, index) => {
                    const baseClassName = [
                        card.onClickRedirectTo ? 'cursor-pointer group' : 'group',
                        'magic-bento-card',
                        card.span || 'col-span-1',
                        textAutoHide ? 'magic-bento-card--text-autohide' : '',
                        enableBorderGlow ? 'magic-bento-card--border-glow' : ''
                    ].filter(Boolean).join(' ');

                    const cardStyle = { '--glow-color': glowColor };

                    if (enableStars) {
                        return (
                            <ParticleCard
                                key={card.label || card.title || index}
                                onClickRedirectTo={card?.onClickRedirectTo}

                                className={baseClassName}
                                style={cardStyle}
                                disableAnimations={shouldDisableAnimations}
                                particleCount={particleCount}
                                glowColor={glowColor}
                                enableTilt={enableTilt}
                                clickEffect={clickEffect}
                                enableMagnetism={enableMagnetism}
                            >
                                <CardInner card={card} />
                            </ParticleCard>
                        );
                    }

                    return (
                        <div
                            key={card.label || card.title || index}
                            role={card?.onClickRedirectTo ? "link" : undefined}
                            tabIndex={card?.onClickRedirectTo ? 0 : undefined}
                            onClick={card?.onClickRedirectTo ? () => redirectTo(card.onClickRedirectTo) : undefined}
                            onKeyDown={card?.onClickRedirectTo ? (e) => { if (e.key === 'Enter' || e.key === ' ') redirectTo(card.onClickRedirectTo); } : undefined}
                            className={baseClassName}
                            style={cardStyle}
                        >
                            <CardInner card={card} />
                        </div>
                    );
                })}
            </BentoCardGrid>
        </div>
    );
};

export default MagicBento;
