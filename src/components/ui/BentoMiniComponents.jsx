"use client";

import { useState, useEffect, useId } from 'react';
import { ArrowUpRight } from 'lucide-react';

export function Sparkline({ values, color }) {
    const max = Math.max(...values), min = Math.min(...values);
    const range = max - min || 1;
    const W = 100, H = 28;
    const pts = values.map((v, i) =>
        `${(i / (values.length - 1)) * W},${H - ((v - min) / range) * H}`
    ).join(' ');
    const id = useId().replace(/:/g, '')
    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 28 }} preserveAspectRatio="none">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`${pts} ${W},${H} 0,${H}`} fill={`url(#${id})`} />
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function MiniBars({ values, color }) {
    const max = Math.max(...values);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
            {values.map((v, i) => (
                // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                <div key={i} style={{
                    flex: 1, height: `${(v / max) * 100}%`,
                    background: i === values.length - 1 ? color : `${color}55`,
                    borderRadius: '3px 3px 0 0'
                }} />
            ))}
        </div>
    );
}

export function Counter({ target, prefix = '', suffix = '' }) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => {
            const s = Date.now(), d = 1600;
            const tick = () => {
                const p = Math.min((Date.now() - s) / d, 1);
                setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
                if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }, 400);
        return () => clearTimeout(t);
    }, [target]);
    return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

export function Chip({ label }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: 10, fontWeight: 700, padding: '2px 8px',
            borderRadius: 99, background: '#dcfce7', color: '#15803d', lineHeight: 1.4
        }}>
            <ArrowUpRight style={{ width: 10, height: 10 }} />
            {label}
        </span>
    );
}

export function IconBox({ icon: Icon, color, bg }) {
    return (
        <div style={{ padding: 10, borderRadius: 14, background: bg, display: 'inline-flex', flexShrink: 0 }}>
            <Icon style={{ width: 20, height: 20, color }} />
        </div>
    );
}

import { motion, AnimatePresence } from 'motion/react';

export function PieChart({ data, size = 80 }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    let cumulativePercent = 0;

    function getCoordinatesForPercent(percent) {
        const p = percent >= 1 ? 0.999999 : percent;
        const x = Math.cos(2 * Math.PI * p);
        const y = Math.sin(2 * Math.PI * p);
        // Rounding to prevent hydration mismatches due to precision differences
        return [Number(x.toFixed(10)), Number(y.toFixed(10))];
    }

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const maskId = useId();

    // Variantes para la entrada escalonada
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.12,
                delayChildren: 0.3
            }
        }
    };

    const sliceVariants = {
        hidden: {
            scale: 0,
            opacity: 0,
            rotate: -20
        },
        visible: {
            scale: 1,
            opacity: 1,
            rotate: 0,
            transition: {
                type: "spring",
                stiffness: 200,
                damping: 15
            }
        }
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }} onMouseMove={handleMouseMove}>
            <motion.svg
                viewBox="-1.1 -1.1 2.2 2.2"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{
                    width: size,
                    height: size,
                    transform: 'rotate(-90deg)',
                    borderRadius: '50%',
                    display: 'block',
                    overflow: 'visible',
                    // Optimizaciones de renderizado para evitar borrosidad
                    shapeRendering: 'geometricPrecision',
                    imageRendering: 'optimizeQuality'
                }}
            >
                <defs>
                    <mask id={maskId}>
                        {/* Fondo blanco: todo lo que sea blanco en la máscara se muestra */}
                        <motion.circle
                            cx="0"
                            cy="0"
                            r="1"
                            fill="white"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                        />
                        {/* Círculo negro al centro: lo que es negro en la máscara se oculta (agujero dona) */}
                        <motion.circle
                            cx="0"
                            cy="0"
                            r="0.45"
                            fill="black"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.9, type: "spring" }}
                        />
                    </mask>
                </defs>

                <g mask={`url(#${maskId})`}>
                    {data.map((slice, i) => {
                        const startPercent = cumulativePercent;
                        cumulativePercent += slice.percent;
                        const endPercent = cumulativePercent;

                        const [startX, startY] = getCoordinatesForPercent(startPercent);
                        const [endX, endY] = getCoordinatesForPercent(endPercent);

                        const largeArcFlag = slice.percent > 0.5 ? 1 : 0;

                        const pathData = [
                            `M ${startX} ${startY}`,
                            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                            'L 0 0',
                        ].join(' ');

                        return (
                            <motion.path
                                key={`slice-${slice.label}-${i}`}
                                d={pathData}
                                fill={slice.color}
                                variants={sliceVariants}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                whileHover={{
                                    scale: 1.05,
                                    // Eliminamos el filtro de brillo que causaba borrosidad
                                    transition: { type: "spring", stiffness: 400, damping: 12 }
                                }}
                                style={{
                                    cursor: 'pointer',
                                    transformOrigin: '0 0',
                                    outline: 'none',
                                    // Añadimos backface-visibility y transform para forzar renderizado limpio
                                    backfaceVisibility: 'hidden',
                                    WebkitFontSmoothing: 'antialiased'
                                }}
                            />
                        );
                    })}
                </g>
            </motion.svg>

            <AnimatePresence>
                {hoveredIndex !== null && data[hoveredIndex] && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        style={{
                            position: 'absolute',
                            left: tooltipPos.x + 10,
                            top: tooltipPos.y - 10,
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            backdropFilter: 'blur(10px)',
                            border: `1px solid ${data[hoveredIndex].color}33`,
                            borderLeft: `5px solid ${data[hoveredIndex].color}`,
                            borderRadius: '12px',
                            padding: '10px 14px',
                            boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.15)',
                            pointerEvents: 'none',
                            zIndex: 9999,
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: '130px',
                            transform: 'translateY(-50%)',
                        }}
                    >
                        <span style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: '2px'
                        }}>
                            {data[hoveredIndex].label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>
                                {(data[hoveredIndex].percent * 100).toFixed(2)}%
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function SankeyChart({ data, width = 400, height = 250, onLinkClick, onNodeClick }) {
    const [hoveredLink, setHoveredLink] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [clickedNode, setClickedNode] = useState(null);
    const [clickedLink, setClickedLink] = useState(null);

    if (!data || !data.nodes || !data.links) return null;

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const nodeWidth = 8;
    const padding = 20;
    const innerWidth = width - (padding * 2);
    const innerHeight = height - (padding * 2);

    // Filter nodes by group
    const sourceNodes = data.nodes.filter(n => n.group === 'source');
    const targetNodes = data.nodes.filter(n => n.group === 'target');

    // Calculate vertical positions
    const getPositions = (nodes) => {
        const total = nodes.reduce((acc, n) => acc + n.value, 0);
        let currentY = 0;
        return nodes.map(n => {
            const h = (n.value / total) * (innerHeight - (nodes.length - 1) * 4);
            const pos = { ...n, y: currentY, h: Math.max(h, 2) };
            currentY += pos.h + 4;
            return pos;
        });
    };

    const positionedSources = getPositions(sourceNodes);
    const positionedTargets = getPositions(targetNodes);

    // Map to find positions easily
    const sourcePosMap = Object.fromEntries(positionedSources.map(n => [n.id, n]));
    const targetPosMap = Object.fromEntries(positionedTargets.map(n => [n.id, n]));

    // Track vertical offset for links at each node
    const sourceLinkOffsets = {};
    const targetLinkOffsets = {};

    const links = data.links.map((link, i) => {
        const source = sourcePosMap[link.source];
        const target = targetPosMap[link.target];

        if (!source || !target) return null;

        const sOffset = sourceLinkOffsets[link.source] || 0;
        const tOffset = targetLinkOffsets[link.target] || 0;

        const totalS = sourceNodes.find(n => n.id === link.source).value;
        const totalT = targetNodes.find(n => n.id === link.target).value;

        const linkHeightS = (link.value / totalS) * source.h;
        const linkHeightT = (link.value / totalT) * target.h;

        const sY = source.y + sOffset + linkHeightS / 2;
        const tY = target.y + tOffset + linkHeightT / 2;

        sourceLinkOffsets[link.source] = sOffset + linkHeightS;
        targetLinkOffsets[link.target] = tOffset + linkHeightT;

        const x0 = padding + nodeWidth;
        const x1 = width - padding - nodeWidth;

        // Bezier path
        const cpx0 = x0 + (x1 - x0) / 2;
        const cpx1 = x1 - (x1 - x0) / 2;
        const d = `M ${x0} ${sY} C ${cpx0} ${sY}, ${cpx1} ${tY}, ${x1} ${tY}`;

        return {
            ...link,
            d,
            strokeWidth: Math.max((linkHeightS + linkHeightT) / 2, 1),
            sourceName: source.name,
            targetName: target.name,
            // preserve any raw/original names provided by the data (e.g., '(vacío)')
            sourceRawName: source.rawName ?? source.name,
            targetRawName: target.rawName ?? target.name
        };
    }).filter(Boolean);

    return (
        <div style={{ position: 'relative', width, height }} onMouseMove={handleMouseMove}>
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                <g transform={`translate(0, ${padding})`}>
                    {/* Links */}
                    {links.map((link, i) => (
                        <motion.path
                            key={`link-${link.sourceName}-${link.targetName}-${i}`}
                            d={link.d}
                            fill="none"
                            stroke={hoveredLink === i ? link.color || '#bc955c' : `${link.color || '#bc955c'}44`}
                            onMouseEnter={() => setHoveredLink(i)}
                            onMouseLeave={() => setHoveredLink(null)}
                            onClick={() => {
                                setClickedLink(i);
                                if (onLinkClick) onLinkClick(link.sourceRawName || link.sourceName, link.targetRawName || link.targetName);
                                setTimeout(() => setClickedLink(null), 300);
                            }}
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ duration: 1, delay: i * 0.05 }}
                            style={{ cursor: 'pointer', strokeWidth: clickedLink === i ? (link.strokeWidth * 1.4) : link.strokeWidth }}
                        />
                    ))}

                    {/* Source Nodes */}
                    {positionedSources.map((node) => (
                        <g key={`s-${node.id}`} transform={`translate(${padding}, ${node.y})`} style={{ cursor: 'pointer' }} onClick={() => {
                            setClickedNode(node.id);
                            if (onNodeClick) onNodeClick(node.rawName || node.name, null);
                            setTimeout(() => setClickedNode(null), 300);
                        }}>
                            <motion.rect
                                width={nodeWidth}
                                height={node.h}
                                fill="#621f32"
                                rx={2}
                                animate={clickedNode === node.id ? { scaleX: 1.06 } : { scaleX: 1 }}
                                style={{ transformOrigin: 'left center' }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            />
                            <motion.text
                                x={-5}
                                y={node.h / 2}
                                textAnchor="end"
                                alignmentBaseline="middle"
                                animate={clickedNode === node.id ? { x: -8 } : { x: -5 }}
                                style={{ fontSize: 8, fontWeight: 600, fill: '#6b7280' }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            >
                                {node.name.length > 20 ? node.name.substring(0, 17) + '...' : node.name}
                            </motion.text>
                        </g>
                    ))}

                    {/* Target Nodes */}
                    {positionedTargets.map((node) => (
                        <g key={`t-${node.id}`} transform={`translate(${width - padding - nodeWidth}, ${node.y})`} style={{ cursor: 'pointer' }} onClick={() => {
                            setClickedNode(node.id);
                            if (onNodeClick) onNodeClick(null, node.rawName || node.name);
                            setTimeout(() => setClickedNode(null), 300);
                        }}>
                            <motion.rect
                                width={nodeWidth}
                                height={node.h}
                                fill="#bc955c"
                                rx={2}
                                animate={clickedNode === node.id ? { scaleX: 1.06 } : { scaleX: 1 }}
                                style={{ transformOrigin: 'right center' }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            />
                            <motion.text
                                x={nodeWidth + 5}
                                y={node.h / 2}
                                alignmentBaseline="middle"
                                animate={clickedNode === node.id ? { x: nodeWidth + 8 } : { x: nodeWidth + 5 }}
                                style={{ fontSize: 9, fontWeight: 800, fill: '#111827' }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            >
                                {node.name}
                            </motion.text>
                        </g>
                    ))}
                </g>
            </svg>

            <AnimatePresence>
                {hoveredLink !== null && links[hoveredLink] && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        style={{
                            position: 'absolute',
                            left: tooltipPos.x + 15,
                            top: tooltipPos.y,
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            backdropFilter: 'blur(10px)',
                            border: `1px solid ${links[hoveredLink].color || '#bc955c'}33`,
                            borderLeft: `5px solid ${links[hoveredLink].color || '#bc955c'}`,
                            borderRadius: '8px',
                            padding: '8px 12px',
                            boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.1)',
                            pointerEvents: 'none',
                            zIndex: 100,
                            minWidth: '150px',
                            transform: 'translateY(-50%)'
                        }}
                    >
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 2 }}>
                            {links[hoveredLink].sourceName}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#111827', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{links[hoveredLink].targetName}</span>
                            <span>{links[hoveredLink].value} plazas</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

