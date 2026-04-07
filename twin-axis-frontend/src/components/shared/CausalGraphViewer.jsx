import React, { useEffect, useRef, useState, useMemo } from 'react';
import { DataSet, Network } from "vis-network/standalone/esm/vis-network.mjs";
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import {
    Crosshair, Focus,
    Download, X, Maximize, Minimize,
    Snowflake, RotateCcw, Camera, FileJson,
    Sun, Moon, ZoomIn, ZoomOut,
    Settings, ChevronDown
} from 'lucide-react';
import './CausalGraphViewer.css';

const CausalGraphViewer = ({
    bMatrixData,
    nodeMapping = [],
    isDarkMode: themeProp,
    hideFullScreenControl = false,
    gasifierName = 'unknown',
    phase = 'overall',
    hiddenNodes = [],
    customDownloadName = null
}) => {
    // --- REFS ---
    const container2D = useRef(null);
    const container3D = useRef(null);
    const container4D = useRef(null);
    const networkRef = useRef(null);
    const graph4DRef = useRef(null);
    const renderer3DRef = useRef(null);
    const animationFrameRef = useRef(null);

    // --- STATE ---
    const [viewMode, setViewMode] = useState('2d'); // '2d', '3d', '4d'
    const [focusMode, setFocusMode] = useState(false);
    // Default to dark mode (True) to match Causal Analysis background
    const [internalDarkMode, setInternalDarkMode] = useState(themeProp ?? true);

    // Sync with prop if it changes (e.g. from StudyDetail)
    useEffect(() => {
        if (themeProp !== undefined) setInternalDarkMode(themeProp);
    }, [themeProp]);

    const isDarkMode = internalDarkMode;

    const graphContainerRef = useRef(null);
    const [isDataFullScreen, setIsDataFullScreen] = useState(false);
    const isFrozenRef = useRef(true);
    const isDataFullScreenRef = useRef(false);
    const focusModeRef = useRef(false);

    // RESTORED FEATURES: Physics & Layout
    const [springLen, setSpringLen] = useState(250);
    const [edgeThreshold, setEdgeThreshold] = useState(0.15);
    const [physicsEnabled, setPhysicsEnabled] = useState(true);
    const [isFrozen, setIsFrozen] = useState(true);
    // Keep refs in sync so event listeners always have the latest value
    useEffect(() => { isFrozenRef.current = isFrozen; }, [isFrozen]);
    useEffect(() => { isDataFullScreenRef.current = isDataFullScreen; }, [isDataFullScreen]);

    // Inspector hidden by default — user clicks nodes/edges or toolbar buttons to open
    const [inspector, setInspector] = useState({ visible: false, type: null, id: null });

    // Collapsible UI panels
    const [toolbarOpen, setToolbarOpen] = useState(false);
    const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [toast, setToast] = useState({ show: false, msg: '' });

    // Local metadata for user edits (labels, sizes)
    const [nodeMetadata, setNodeMetadata] = useState({});

    const showToast = (msg) => { setToast({ show: true, msg }); setTimeout(() => setToast({ show: false, msg: '' }), 2000); };

    const handleUpdateNode = (id, field, value) => {
        setNodeMetadata(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || { label: id, size: 30 }),
                [field]: value
            }
        }));
    };

    // 4D Configuration (Matched to HTML)
    const [config4D, setConfig4D] = useState({
        charge: -400,
        flowSpeed: 1.0,
        threshold: 0.0,
        showLabels: true,
        showWeights: true,
        showFlow: true,
        curved: true
    });

    // Dynamic color palette based on theme
    const colors = useMemo(() => ({
        pos: isDarkMode ? '#3b82f6' : '#2563eb',     // Blue
        neg: isDarkMode ? '#ef4444' : '#dc2626',     // Red
        bg: isDarkMode ? '#030304' : '#f8fafc',      // Canvas
        panelBg: isDarkMode ? 'rgba(20, 20, 25, 0.85)' : 'rgba(255, 255, 255, 0.9)',
        border: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
        textPrimary: isDarkMode ? '#ffffff' : '#0f172a',
        textSecondary: isDarkMode ? '#a1a1aa' : '#64748b',
        accent: isDarkMode ? '#38bdf8' : '#0284c7',
        nodeBg: isDarkMode ? '#111111' : '#ffffff',
        nodeBorder: isDarkMode ? '#45a29e' : '#0284c7',
        warning: '#ffc107',
        critical: '#ff4d4d'
    }), [isDarkMode]);

    // Vis Data
    const nodes = useMemo(() => new DataSet([]), []);
    const edges = useMemo(() => new DataSet([]), []);

    useEffect(() => { focusModeRef.current = focusMode; }, [focusMode]);

    // =========================================================================
    // SHARED DATA PROCESSING (The "Truth" for 2D/3D/4D)
    // =========================================================================
    // Convert hidden nodes to strings for robust matching
    const hiddenNodesSet = useMemo(() => new Set((hiddenNodes || []).map(String)), [hiddenNodes]);

    useEffect(() => {
        if (!bMatrixData || !bMatrixData.data) return;

        const newNodes = [];
        const newEdges = [];
        const nodeNames = bMatrixData.columns; // The canonical list of nodes
        const centerX = 0; const centerY = 0; const radius = 300;

        // 1. GENERATE NODES (Same for all views)
        nodeNames.forEach((name, index) => {
            if (hiddenNodesSet.has(String(name))) return;

            const meta = nodeMetadata[name] || {};

            // Resolve full display name: 1. User Edit -> 2. Mapping -> 3. ID
            let fullLabel = meta.label;
            if (!fullLabel) {
                const mapped = nodeMapping.find(m => String(m.id) === String(name));
                fullLabel = mapped ? mapped.name : name;
            }

            // 1-based index number to display inside the dot
            const nodeNumber = String(index + 1);
            const nodeSize = meta.size || 32;

            const nodeObj = {
                id: name,
                // Center large number inside circle
                label: nodeNumber,
                title: fullLabel, // tooltip on hover
                shape: 'circle',
                size: nodeSize,
                group: 'default',
                color: {
                    background: isDarkMode ? '#1e3a8a' : '#e0f2fe',
                    border: isDarkMode ? '#38bdf8' : '#0ea5e9',
                    highlight: {
                        background: '#ff0000',
                        border: '#cc0000'
                    }
                },
                font: {
                    size: 18,
                    face: 'Inter',
                    bold: { size: 18, color: isDarkMode ? '#bae6fd' : '#1e3a8a', mod: 'bold' },
                    color: isDarkMode ? '#bae6fd' : '#1e3a8a',
                    strokeWidth: 0,
                },
                _fullName: fullLabel,
                _index: nodeNumber
            };

            // Reference layout: Circular distribution
            const angle = (index / nodeNames.length) * 2 * Math.PI;
            nodeObj.x = centerX + radius * Math.cos(angle);
            nodeObj.y = centerY + radius * Math.sin(angle);

            // Every node is pinned by default to match "reference positions"
            nodeObj.fixed = true;

            // Use custom position if user has moved it
            if (meta.x !== undefined) {
                nodeObj.x = meta.x;
                nodeObj.y = meta.y;
            }

            newNodes.push(nodeObj);
        });

        // 2. GENERATE EDGES (Iterate Rows vs Columns)
        // Row Index = Target Node Index. 
        // Column Name = Source Node Name.
        bMatrixData.data.forEach((row, rowIndex) => {
            let target = row.Pixel || row.index;
            // Fallback if row doesn't have a name property: use index from columns
            if (!target && rowIndex < nodeNames.length) target = nodeNames[rowIndex];

            if (!target) return;
            if (hiddenNodesSet.has(String(target))) return;

            nodeNames.forEach(source => {
                if (hiddenNodesSet.has(String(source))) return;
                if (row[source] !== undefined) {
                    const weight = parseFloat(row[source]);
                    // Basic threshold for 2D view (can be stricter than 4D)
                    if (Math.abs(weight) >= edgeThreshold && String(target) !== String(source)) {
                        newEdges.push({
                            from: source,
                            to: target,
                            label: weight.toFixed(2),
                            arrows: 'to',
                            width: Math.abs(weight) * 5,
                            color: {
                                color: weight < 0 ? colors.warning : colors.nodeBorder,
                                highlight: '#ff0000',
                                hover: '#ff0000'
                            }
                        });
                    }
                }
            });
        });

        nodes.clear(); edges.clear();
        nodes.add(newNodes); edges.add(newEdges);

        // Force a fit and redraw after data change
        if (networkRef.current) {
            setTimeout(() => {
                networkRef.current.fit({ animation: true });
                networkRef.current.redraw();
            }, 100);
        }
    }, [bMatrixData, nodes, edges, colors, nodeMetadata, hiddenNodesSet, edgeThreshold]);

    // =========================================================================
    // 1. VIS NETWORK (2D EDITOR)
    // =========================================================================
    useEffect(() => {
        if (!container2D.current) return;

        const options = {
            physics: {
                enabled: physicsEnabled,
                barnesHut: { gravitationalConstant: -8000, centralGravity: 0.1, springLength: springLen, damping: 0.2 },
                stabilization: { iterations: 200 }
            },
            nodes: {
                // Per-node font is set in data; these are defaults/fallbacks
                font: { face: 'Inter', color: colors.textPrimary, strokeWidth: isDarkMode ? 4 : 0, strokeColor: colors.bg, size: 13 },
                borderWidth: 2.5, shape: 'dot', size: 32,
                shadow: { enabled: true, color: 'rgba(69, 162, 158, 0.3)', size: 10, x: 0, y: 0 }
            },
            edges: {
                smooth: { type: 'dynamic', roundness: 0.5 },
                font: {
                    background: isDarkMode ? '#1e293b' : '#ffffff',
                    color: isDarkMode ? '#e2e8f0' : '#0f172a',
                    strokeWidth: 0,
                    size: 12,
                    face: 'Inter',
                    align: 'middle',
                },
                width: 2,
                color: { color: isDarkMode ? '#64748b' : '#3b82f6', highlight: '#ff0000', hover: '#ff0000' },
                arrows: { to: { enabled: true, scaleFactor: 1.2 } }
            },
            interaction: {
                hover: true,
                multiselect: true,
                zoomView: !isFrozen,
                dragView: !isFrozen,
                dragNodes: !isFrozen
            }
        };

        const network = new Network(container2D.current, { nodes, edges }, options);
        networkRef.current = network;

        // --- CUSTOM RENDERING FOR OUTWARD LABELS ---
        network.on("afterDrawing", (ctx) => {
            const nodePositions = network.getPositions();

            // Iterate over all nodes to draw outward labels
            nodes.forEach(node => {
                const pos = nodePositions[node.id];
                if (!pos) return;

                const label = node._fullName || node.id;

                // If label is just the index number, skip drawing it outward 
                // to avoid the "double node number" look requested by user
                if (String(label) === String(node._index)) return;

                // Calculate vector from center (0,0) to node
                // If node is at exactly 0,0 (rare), default to up
                let dx = pos.x;
                let dy = pos.y;
                let angle = Math.atan2(dy, dx);

                // Fixed distance from node center: node radius (approx 30) + spacer
                const distanceC = 45;

                // Position for text
                const tx = pos.x + Math.cos(angle) * distanceC;
                const ty = pos.y + Math.sin(angle) * distanceC;

                ctx.save();
                ctx.font = "bold 13px Inter";
                ctx.fillStyle = colors.textPrimary;
                ctx.textAlign = Math.abs(dx) < 10 ? 'center' : (dx > 0 ? 'start' : 'end');
                ctx.textBaseline = 'middle';

                // Optional: add a small background box for readability against edges
                const width = ctx.measureText(label).width;
                const height = 16; // approx

                ctx.globalAlpha = 0.8;
                ctx.fillStyle = colors.bg;
                // Adjust rect based on alignment
                let rx = tx;
                if (ctx.textAlign === 'center') rx = tx - width / 2;
                else if (ctx.textAlign === 'end') rx = tx - width;

                ctx.fillRect(rx - 2, ty - height / 2 - 1, width + 4, height + 2);

                ctx.globalAlpha = 1.0;
                ctx.fillStyle = colors.textPrimary; // Text color
                ctx.fillText(label, tx, ty);
                ctx.restore();
            });

            // Draw a rotated border around the edge weight label boxes
            const edgeIds = edges.getIds();
            const edgeNodePositions = network.getPositions();
            edgeIds.forEach(edgeId => {
                const edgeObj = network.body.edges[edgeId];
                if (edgeObj && edgeObj.labelModule && edgeObj.labelModule.size) {
                    const s = edgeObj.labelModule.size;
                    if (s.left === undefined || s.top === undefined) return;

                    // Calculate the edge angle from its connected node positions
                    let angle = 0;
                    const fromId = edgeObj.fromId;
                    const toId = edgeObj.toId;
                    const fromPos = edgeNodePositions[fromId];
                    const toPos = edgeNodePositions[toId];
                    if (fromPos && toPos) {
                        angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
                        // Keep angle in [-PI/2, PI/2] range (vis-network flips labels so they're always readable)
                        if (angle > Math.PI / 2) angle -= Math.PI;
                        if (angle < -Math.PI / 2) angle += Math.PI;
                    }

                    // Center of the label box
                    const cx = s.left + s.width / 2;
                    const cy = s.top + s.height / 2;

                    ctx.save();
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = colors.textSecondary;
                    ctx.translate(cx, cy);
                    ctx.rotate(angle);
                    ctx.strokeRect(-s.width / 2 - 3, -s.height / 2 - 3, s.width + 6, s.height + 6);
                    ctx.restore();
                }
            });
        });

        network.on("click", (params) => {
            if (params.nodes.length === 1) openInspector('node', params.nodes[0]);
            else if (params.edges.length === 1) openInspector('edge', params.edges[0]);
            else setInspector(prev => ({ ...prev, type: null, id: null })); // Don't close, just show Global Actions
        });

        network.on("dragEnd", (params) => {
            if (params.nodes.length === 1) {
                const nodeId = params.nodes[0];
                const pos = network.getPositions([nodeId])[nodeId];
                // Pin the node after drag (The @causal.html way to "stick")
                nodes.update({ id: nodeId, fixed: { x: true, y: true } });
                // Save to metadata for persistence across data changes
                handleUpdateNode(nodeId, 'x', pos.x);
                handleUpdateNode(nodeId, 'y', pos.y);
                handleUpdateNode(nodeId, 'fixed', true);
            }
        });

        network.on("dragStart", (params) => {
            if (params.nodes.length === 1) {
                // Unpin while dragging if you want it to push/pull others freely
                nodes.update({ id: params.nodes[0], fixed: { x: false, y: false } });
            }
        });

        return () => network.destroy();
    }, [container2D, nodes, edges, colors, physicsEnabled, springLen, isDarkMode]);

    // React to Physics/Spring changes dynamically
    useEffect(() => {
        if (networkRef.current) networkRef.current.setOptions({ physics: { enabled: physicsEnabled, barnesHut: { springLength: springLen } } });
    }, [springLen, physicsEnabled]);

    // React to freeze/unfreeze changes dynamically via both setOptions AND wheel event blocking
    useEffect(() => {
        if (networkRef.current) {
            networkRef.current.setOptions({
                interaction: {
                    zoomView: !isFrozen,
                    dragView: !isFrozen,
                    dragNodes: !isFrozen
                }
            });
        }

        const el = container2D.current;
        if (!el) return;

        // More aggressive wheel blocking using capture phase
        const blockWheel = (e) => {
            if (isFrozenRef.current) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        el.addEventListener('wheel', blockWheel, { passive: false, capture: true });
        el.addEventListener('mousewheel', blockWheel, { passive: false, capture: true });

        return () => {
            el.removeEventListener('wheel', blockWheel, { capture: true });
            el.removeEventListener('mousewheel', blockWheel, { capture: true });
        };
    }, [isFrozen]);


    // =========================================================================
    // 2. THREE.JS (3D Custom Flow)
    // =========================================================================
    useEffect(() => {
        if (viewMode !== '3d' || !container3D.current) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            return;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(isDarkMode ? 0x0b0c10 : 0xf8fafc);

        const camera = new THREE.PerspectiveCamera(50, container3D.current.clientWidth / container3D.current.clientHeight, 1, 5000);
        camera.position.set(0, 300, 600);

        // Store camera in a ref if we need to update it on resize
        const cameraRef = { current: camera };

        if (!renderer3DRef.current) {
            renderer3DRef.current = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer3DRef.current.toneMapping = THREE.ACESFilmicToneMapping;
            renderer3DRef.current.toneMappingExposure = 1.2;
        }
        const renderer = renderer3DRef.current;
        renderer.setSize(container3D.current.offsetWidth, container3D.current.offsetHeight);

        if (container3D.current.children.length === 0) {
            container3D.current.appendChild(renderer.domElement);
            container3D.current.oncontextmenu = (e) => e.preventDefault();
        }

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.05;

        scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const mainSun = new THREE.DirectionalLight(0xffffff, 1.0);
        mainSun.position.set(100, 200, 100); scene.add(mainSun);

        // Build Graph using Vis Data
        const positions = networkRef.current ? networkRef.current.getPositions() : {};
        const nodeMap = {};
        const particleSystems = [];
        const getZ = (id) => (((String(id).charCodeAt(0) * 53) % 160) - 80);

        nodes.forEach((n, index) => {
            let p = positions[n.id];
            if (!p || (p.x === 0 && p.y === 0)) {
                const angle = (index / nodes.length) * 2 * Math.PI;
                p = { x: 200 * Math.cos(angle), y: 200 * Math.sin(angle) };
            }
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry((n.size || 30) * 0.7, 32, 32),
                new THREE.MeshPhysicalMaterial({
                    color: isDarkMode ? 0x111111 : 0xffffff,
                    emissive: n.color?.border || colors.nodeBorder,
                    emissiveIntensity: 0.6,
                    roughness: 0.1,
                    metalness: 0.3
                })
            );
            mesh.position.set(p.x, -p.y, getZ(n.id));
            scene.add(mesh);
            nodeMap[n.id] = mesh.position;

            const sprite = createLabel(n.label);
            sprite.position.copy(mesh.position); sprite.position.y += 40;
            scene.add(sprite);
        });

        edges.forEach(e => {
            const s = nodeMap[e.from]; const t = nodeMap[e.to];
            if (s && t) {
                const mid = new THREE.Vector3().lerpVectors(s, t, 0.5); mid.y += s.distanceTo(t) * 0.2;
                const curve = new THREE.QuadraticBezierCurve3(s, mid, t);
                const tubeMat = new THREE.MeshStandardMaterial({ color: e.color?.color === colors.critical ? 0xff4d4d : 0x334455, transparent: true, opacity: 0.3 });
                scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, (e.width || 2) * 0.5, 8, false), tubeMat));

                // Particles
                const glowCol = e.color?.color === colors.critical ? colors.critical : colors.nodeBorder;
                const glowTex = createGlowTexture(new THREE.Color(glowCol));
                for (let i = 0; i < 3; i++) {
                    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: glowCol, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.9 }));
                    sprite.scale.set(10, 10, 1); scene.add(sprite);
                    particleSystems.push({ mesh: sprite, curve: curve, t: Math.random(), speed: 0.005 });
                }
            }
        });

        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);
            controls.update();
            // Update camera aspect on every frame or on resize
            if (container3D.current) {
                const w = container3D.current.offsetWidth;
                const h = container3D.current.offsetHeight;
                if (camera.aspect !== w / h) {
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                }
            }
            particleSystems.forEach(p => { p.t += p.speed; if (p.t > 1) p.t = 0; p.mesh.position.copy(p.curve.getPoint(p.t)); });
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            while (scene.children.length > 0) { scene.remove(scene.children[0]); }
        };
    }, [viewMode, nodes, edges, colors, isDarkMode]);


    // =========================================================================
    // 3. OMNI 4D (Matched to 2D B-Mat Logic)
    // =========================================================================
    useEffect(() => {
        if (!container4D.current) return;

        if (!graph4DRef.current) {
            graph4DRef.current = ForceGraph3D()(container4D.current);
            const fg = graph4DRef.current;
            fg.backgroundColor(colors.bg).showNavInfo(false).nodeRelSize(5);
            const controls = fg.controls();
            if (controls) controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        }

        const fg = graph4DRef.current;
        if (viewMode !== '4d' || !bMatrixData || !bMatrixData.data) {
            fg.pauseAnimation(); fg.graphData({ nodes: [], links: [] }); return;
        }

        fg.resumeAnimation();
        fg.width(container4D.current.offsetWidth);
        fg.height(container4D.current.offsetHeight);

        // --- EXACT DATA REPLICATION FROM 2D ---
        const nodeNames = bMatrixData.columns || [];
        const gNodes = new Set();
        const gLinks = [];

        // Iterate EXACTLY like 2D: Row Index = Target, Column = Source
        bMatrixData.data.forEach((row, rowIndex) => {
            let target = row.Pixel || row.index;
            if (!target && rowIndex < nodeNames.length) target = nodeNames[rowIndex];

            if (!target) return;
            if (hiddenNodesSet.has(String(target))) return;
            gNodes.add(target);

            nodeNames.forEach(source => {
                if (hiddenNodesSet.has(String(source))) return;
                // Source must be in our known columns
                if (row[source] !== undefined) {
                    const weight = parseFloat(row[source]);
                    // Apply 4D specific threshold (slider)
                    if (Math.abs(weight) >= config4D.threshold && String(target) !== String(source)) {
                        gNodes.add(source); // Ensure source exists
                        gLinks.push({
                            source: source,
                            target: target, // Row is Target
                            value: weight
                        });
                    }
                }
            });
        });

        fg.graphData({
            nodes: Array.from(gNodes).map(id => {
                const meta = nodeMetadata[id] || {};
                return { id, label: meta.label || id };
            }),
            links: gLinks
        });
        fg.d3Force('charge').strength(config4D.charge);

        fg.nodeThreeObject(node => {
            const group = new THREE.Group();
            const geometry = new THREE.SphereGeometry(5, 32, 32);
            const material = new THREE.MeshPhongMaterial({ color: colors.pos, emissive: '#1d4ed8', emissiveIntensity: 0.5, shininess: 90 });
            group.add(new THREE.Mesh(geometry, material));

            if (config4D.showLabels) {
                const label = node.label || node.id;
                const sprite = new SpriteText(label);
                sprite.color = colors.textPrimary;
                sprite.backgroundColor = colors.panelBg;
                sprite.padding = 3; sprite.borderRadius = 4; sprite.textHeight = 4;
                sprite.position.y = 8; sprite.fontFace = 'Inter'; sprite.fontWeight = '600';
                group.add(sprite);
            }
            return group;
        });

        fg.linkWidth(l => Math.abs(l.value) * 1.5)
            .linkColor(l => l.value > 0 ? colors.pos : colors.neg)
            .linkOpacity(0.3)
            .linkCurvature(config4D.curved ? 0.2 : 0)
            .linkDirectionalParticles(config4D.showFlow ? 3 : 0)
            .linkDirectionalParticleSpeed(d => Math.abs(d.value) * 0.005 * config4D.flowSpeed)
            .linkDirectionalParticleWidth(2.5);

        fg.linkThreeObjectExtend(true)
            .linkThreeObject(link => {
                if (!config4D.showWeights) return null;
                const val = parseFloat(link.value).toFixed(2);
                const sprite = new SpriteText(val);
                sprite.color = link.value > 0 ? '#60a5fa' : '#f87171';
                sprite.textHeight = 4.5; // Reduced from 6
                sprite.fontWeight = '900';
                sprite.backgroundColor = 'rgba(0,0,0,0.7)';
                sprite.padding = 1.5; sprite.borderRadius = 2; sprite.fontFace = 'Inter';
                return sprite;
            })
            .linkPositionUpdate((sprite, { start, end }) => {
                const cx = start.x + (end.x - start.x) / 2; const cy = start.y + (end.y - start.y) / 2; const cz = start.z + (end.z - start.z) / 2;
                Object.assign(sprite.position, { x: cx, y: cy, z: cz });
            });

        fg.onNodeClick(node => {
            const dist = 60; const distRatio = 1 + dist / Math.hypot(node.x, node.y, node.z);
            fg.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 1500);
            openInspector('node', node.id);
        });
        fg.onBackgroundClick(closeInspector);
        fg.d3ReheatSimulation();

    }, [viewMode, bMatrixData, config4D, colors, nodeMetadata, isDarkMode, hiddenNodesSet]);

    // =========================================================================
    // UI HANDLERS (Restored)
    // =========================================================================
    const openInspector = (type, id) => setInspector({ visible: true, type, id });
    const closeInspector = () => setInspector(prev => ({ ...prev, visible: false }));

    const handleFullScreen = () => {
        const el = graphContainerRef.current;
        if (!el) return;

        if (!document.fullscreenElement) {
            const requestMethod = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
            if (requestMethod) {
                requestMethod.call(el).then(() => {
                    setIsDataFullScreen(true);
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                    }, 300);
                }).catch(err => {
                    console.error("Fullscreen Error:", err);
                    setIsDataFullScreen(true); // Fallback to CSS if API fails? No, user wants native.
                });
            } else {
                // Fallback to CSS only if API doesn't exist at all
                setIsDataFullScreen(true);
            }
        } else {
            document.exitFullscreen();
        }
    };

    // Sync fullscreen state if user exits via Escape key
    useEffect(() => {
        const onFsChange = () => setIsDataFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);
    const handleDownload = () => {
        const link = document.createElement('a');
        const now = new Date();
        const dateStr = now.toLocaleDateString().replace(/\//g, '-');
        const timeStr = now.toLocaleTimeString().replace(/:/g, '-').replace(/\s/g, '');
        const timestamp = `${dateStr}_${timeStr}`;

        // Use clean gassifier name and phase
        const gName = gasifierName.toLowerCase();
        let pName = phase.toLowerCase();

        // 1. Remove redundant gasifier name from phase if present
        if (pName.startsWith(gName)) {
            pName = pName.substring(gName.length).replace(/^_+/, '');
        }

        // 2. Remove common redundant suffixes to keep it concise
        pName = pName.replace(/_causal_results$/, '').replace(/_causal_model$/, '');

        const safeGasifier = gName.replace(/[^a-z0-9]/gi, '_');
        const safePhase = pName.replace(/[^a-z0-9]/gi, '_') || 'overall';
        const defaultName = `${safeGasifier}_${safePhase}_causal_${viewMode}_${timestamp}.png`;

        link.download = customDownloadName ? `${customDownloadName}.png` : defaultName;
        let canvas;
        let isTempResize = false;
        let oldWidth, oldHeight, oldScale, oldPos;
        const net = networkRef.current;

        if (viewMode === '2d' && net && container2D.current) {
            oldWidth = container2D.current.style.width;
            oldHeight = container2D.current.style.height;
            oldScale = net.getScale();
            oldPos = net.getViewPosition();

            // Force high resolution fullscreen canvas
            container2D.current.style.width = '1920px';
            container2D.current.style.height = '1080px';
            net.setSize('1920px', '1080px');

            // Fit to screen and pad it so labels don't get cut
            net.fit({ animation: false });
            net.moveTo({
                scale: net.getScale() * 0.8,
                position: net.getViewPosition(),
                animation: false
            });
            net.redraw();

            canvas = container2D.current.querySelector('canvas');
            isTempResize = true;
        } else if (viewMode === '3d') {
            canvas = container3D.current.querySelector('canvas');
        } else if (viewMode === '4d') {
            canvas = container4D.current.querySelector('canvas');
        }

        if (canvas) {
            // Create a temporary canvas to draw the background
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const ctx = tempCanvas.getContext('2d');

            // Fill with theme background color
            ctx.fillStyle = colors.bg;
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            // Draw the original graph on top
            ctx.drawImage(canvas, 0, 0);

            link.href = tempCanvas.toDataURL('image/png');
            link.click();
            showToast("Snapshot Saved");

            // Ensure we instantly restore layout without user ever noticing flash
            if (isTempResize) {
                container2D.current.style.width = oldWidth || '100%';
                container2D.current.style.height = oldHeight || '100%';
                net.setSize(oldWidth || '100%', oldHeight || '100%');
                net.moveTo({ scale: oldScale, position: oldPos, animation: false });
                net.redraw();
            }
        }
    };

    const handleExportJSON = () => {
        const data = { nodes: nodes.get(), edges: edges.get() };
        const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const link = document.createElement('a');
        link.href = str; link.download = 'causal_model.json';
        link.click(); showToast("JSON Exported");
    };

    const handleResetPositions = () => {
        // Complete wipe of position data to return to canonical circular layout
        setNodeMetadata(prev => {
            const reset = {};
            Object.keys(prev).forEach(id => {
                reset[id] = { label: prev[id].label, size: prev[id].size };
            });
            return reset;
        });

        if (networkRef.current) {
            nodes.getIds().forEach(id => nodes.update({ id, fixed: { x: true, y: true } }));
            networkRef.current.fit({ animation: true });
        }
        showToast("Layout Restored");
    };

    // =========================================================================
    // 5. RESIZE & FULLSCREEN HANDLING
    // =========================================================================
    useEffect(() => {
        const handleResize = () => {
            // Update 3D
            if (viewMode === '3d' && renderer3DRef.current && container3D.current) {
                const w = container3D.current.offsetWidth;
                const h = container3D.current.offsetHeight;
                renderer3DRef.current.setSize(w, h);
            }
            // Update 4D
            if (viewMode === '4d' && graph4DRef.current && container4D.current) {
                graph4DRef.current.width(container4D.current.offsetWidth);
                graph4DRef.current.height(container4D.current.offsetHeight);
            }
            // Update 2D
            if (viewMode === '2d' && networkRef.current) {
                networkRef.current.setSize('100%', '100%');
                networkRef.current.redraw();
            }
        };

        window.addEventListener('resize', handleResize);
        document.addEventListener('fullscreenchange', handleResize);

        setTimeout(handleResize, 100);

        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('fullscreenchange', handleResize);
        };
    }, [viewMode, isDataFullScreen]);

    const handleZoom = (factor) => {
        if (!networkRef.current) return;
        const currentScale = networkRef.current.getScale();
        const newScale = factor > 1 ? currentScale * 1.2 : currentScale / 1.2;
        networkRef.current.moveTo({
            scale: newScale,
            animation: { duration: 300, easingFunction: 'easeInOutQuad' }
        });
    };

    // --- HELPERS ---
    const createLabel = (text) => {
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
        ctx.font = `Bold 60px Inter`; const w = ctx.measureText(text).width + 50; const h = 100;
        canvas.width = w; canvas.height = h;
        ctx.fillStyle = isDarkMode ? "rgba(10,10,15,0.8)" : "rgba(255,255,255,0.9)";
        ctx.strokeStyle = colors.nodeBorder; ctx.lineWidth = 4;
        ctx.roundRect(4, 4, w - 8, h - 8, 20); ctx.fill(); ctx.stroke();
        ctx.fillStyle = colors.textPrimary; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, w / 2, h / 2);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
        sprite.scale.set(w / 5, h / 5, 1); return sprite;
    };
    const createGlowTexture = (color) => {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
        grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.2, `rgba(${color.r * 255},${color.g * 255},${color.b * 255},1)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    };

    return (
        <div
            ref={graphContainerRef}
            className={`causal-graph-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}
        >
            {/* CANVASES */}
            <div id="network-2d" ref={container2D} style={{ display: viewMode === '2d' ? 'block' : 'none', height: '100%' }}></div>
            <div id="network-3d" ref={container3D} style={{ display: viewMode === '3d' ? 'block' : 'none', height: '100%' }}></div>
            <div id="network-4d" ref={container4D} style={{ display: viewMode === '4d' ? 'block' : 'none', height: '100%' }}></div>

            {/* QUICK THRESHOLD CONTROLLER (FLOATING BOTTOM RIGHT) */}
            <div className={`absolute right-3 bottom-3 z-10 flex flex-col gap-1 p-2 rounded shadow-md border backdrop-blur-sm transition-colors ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white/80 border-slate-200 text-slate-700'}`}>
                <label className="text-[10px] font-bold uppercase tracking-wider opacity-80">Threshold</label>
                <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={edgeThreshold}
                    onChange={(e) => setEdgeThreshold(parseFloat(e.target.value) || 0)}
                    className={`px-2 py-1 text-xs font-semibold outline-none rounded border transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-600 focus:border-sky-500' : 'bg-white border-slate-300 focus:border-blue-500'} w-20`}
                />
            </div>

            {/* VIEW SWITCHER — collapsible dropdown */}
            <div className="top-right-group">
                <div className="ui-panel view-pill">
                    <button
                        className="view-trigger-btn"
                        onClick={() => setViewDropdownOpen(v => !v)}
                        title="Switch view"
                    >
                        <span>{viewMode === '2d' ? 'Editor' : viewMode === '3d' ? '3D Flow' : '4D Omni'}</span>
                        <ChevronDown size={12} className={`view-chevron ${viewDropdownOpen ? 'open' : ''}`} />
                    </button>
                    {viewDropdownOpen && (
                        <div className="view-dropdown">
                            <button
                                className={`view-btn ${viewMode === '2d' ? 'active' : ''}`}
                                onClick={() => { setViewMode('2d'); setViewDropdownOpen(false); }}
                            >Editor</button>
                            <button
                                className={`view-btn ${viewMode === '3d' ? 'active' : ''}`}
                                onClick={() => { setViewMode('3d'); setViewDropdownOpen(false); }}
                            >3D Flow</button>
                            <button
                                className={`view-btn ${viewMode === '4d' ? 'active' : ''}`}
                                onClick={() => { setViewMode('4d'); setInspector({ visible: true, type: '4d' }); setViewDropdownOpen(false); }}
                            >4D Omni</button>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN TOOLBAR — single gear icon always visible */}
            <div className="ui-panel toolbar">
                <button
                    className={`icon-btn toolbar-toggle-btn ${toolbarOpen ? 'active' : ''}`}
                    onClick={() => setToolbarOpen(o => !o)}
                    title={toolbarOpen ? 'Hide Controls' : 'Show Controls'}
                >
                    <Settings size={15} />
                </button>
            </div>

            {/* TOOLBAR POPOVER — floats to the right of the gear icon */}
            {toolbarOpen && (
                <div className="toolbar-popover">
                    <button className={`icon-btn ${isFrozen ? 'active' : ''}`}
                        onClick={() => setIsFrozen(!isFrozen)}
                        title={isFrozen ? 'Unlock Zoom/Pan' : 'Freeze Graph'}>
                        <Snowflake size={15} />
                    </button>
                    <button className={`icon-btn ${focusMode ? 'active' : ''}`} onClick={() => setFocusMode(!focusMode)} title="Focus Mode"><Crosshair size={15} /></button>
                    <button className="icon-btn" onClick={handleResetPositions} title="Reset View"><Focus size={15} /></button>
                    <button className="icon-btn" onClick={() => handleZoom(1.2)} title="Zoom In"><ZoomIn size={15} /></button>
                    <button className="icon-btn" onClick={() => handleZoom(0.8)} title="Zoom Out"><ZoomOut size={15} /></button>
                    <button className="icon-btn" onClick={() => setInternalDarkMode(v => !v)} title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} Mode`}>
                        {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                    </button>
                    <button className="icon-btn" onClick={handleDownload} title="Download Image"><Camera size={15} /></button>
                    <button className="icon-btn" onClick={handleExportJSON} title="Export JSON"><FileJson size={15} /></button>
                    {!hideFullScreenControl && (
                        <button className="icon-btn" onClick={handleFullScreen} title="Fullscreen">{isDataFullScreen ? <Minimize size={15} /> : <Maximize size={15} />}</button>
                    )}
                    {/* Advanced sub-section — Spring length hidden here */}
                    {viewMode === '2d' && (
                        <div className="toolbar-advanced-section">
                            <button
                                className="toolbar-advanced-toggle"
                                onClick={() => setAdvancedOpen(o => !o)}
                                title="Advanced Settings"
                            >
                                <span>Advanced</span>
                                <ChevronDown size={11} className={`toolbar-adv-chevron ${advancedOpen ? 'open' : ''}`} />
                            </button>
                            {advancedOpen && (
                                <>
                                    <div className="toolbar-spring-row" style={{ marginBottom: '8px' }}>
                                        <span className="toolbar-spring-label" style={{ fontSize: '11px', color: isDarkMode ? '#a1a1aa' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Threshold</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={edgeThreshold}
                                            onChange={(e) => setEdgeThreshold(parseFloat(e.target.value) || 0)}
                                            style={{ width: '50px', marginLeft: 'auto', padding: '1px 3px', fontSize: '11px', background: isDarkMode ? '#0f172a' : '#f8fafc', color: isDarkMode ? '#e2e8f0' : '#334155', border: '1px solid', borderColor: isDarkMode ? '#334155' : '#cbd5e1', borderRadius: '3px', outline: 'none' }}
                                        />
                                    </div>
                                    <div className="toolbar-spring-row">
                                        <span className="toolbar-spring-label">Spring</span>
                                        <input
                                            type="range" min="50" max="600" value={springLen}
                                            className="toolbar-spring-slider"
                                            onChange={(e) => setSpringLen(parseInt(e.target.value))}
                                        />
                                        <span className="toolbar-spring-val">{springLen}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}



            {/* INSPECTOR */}
            <div className={`ui-panel inspector ${inspector.visible ? 'visible' : ''}`}>
                <div className="inspector-header">
                    <span>{inspector.type === '4d' ? 'CAUSAL OMNI' : 'DETAILS'}</span>
                    <button className="close-btn" onClick={closeInspector}><X size={16} /></button>
                </div>
                <div className="inspector-body">
                    {inspector.type === '4d' && (
                        <div className="omni-controls">
                            <div className="section-title">VISUAL PHYSICS</div>
                            <div className="control-row"><div className="control-label"><span>Gravity</span> <span>{config4D.charge}</span></div><input type="range" min="-1000" max="-50" value={config4D.charge} onChange={(e) => setConfig4D(p => ({ ...p, charge: parseInt(e.target.value) }))} /></div>
                            <div className="control-row"><div className="control-label"><span>Flow Speed</span> <span>{config4D.flowSpeed}</span></div><input type="range" min="0" max="5" step="0.1" value={config4D.flowSpeed} onChange={(e) => setConfig4D(p => ({ ...p, flowSpeed: parseFloat(e.target.value) }))} /></div>
                            <div className="control-row">
                                <div className="control-label"><span>Min Weight</span> <span>{config4D.threshold.toFixed(2)}</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={config4D.threshold}
                                    onChange={(e) => setConfig4D(p => ({ ...p, threshold: parseFloat(e.target.value) }))} />
                            </div>
                            <div className="section-title" style={{ marginTop: '15px' }}>FILTERS</div>
                            <div className="toggle-grid">
                                <button className={`toggle-btn ${config4D.showLabels ? 'active' : ''}`} onClick={() => setConfig4D(p => ({ ...p, showLabels: !p.showLabels }))}>Labels</button>
                                <button className={`toggle-btn ${config4D.showWeights ? 'active' : ''}`} onClick={() => setConfig4D(p => ({ ...p, showWeights: !p.showWeights }))}>Weights</button>
                                <button className={`toggle-btn ${config4D.showFlow ? 'active' : ''}`} onClick={() => setConfig4D(p => ({ ...p, showFlow: !p.showFlow }))}>Flow</button>
                                <button className={`toggle-btn ${config4D.curved ? 'active' : ''}`} onClick={() => setConfig4D(p => ({ ...p, curved: !p.curved }))}>Curve</button>
                            </div>
                        </div>
                    )}
                    {inspector.type === 'node' && (
                        <div className="node-details">
                            <div className="input-group">
                                <label>Node ID / Label</label>
                                <input
                                    type="text"
                                    value={nodeMetadata[inspector.id]?.label || inspector.id}
                                    onChange={(e) => handleUpdateNode(inspector.id, 'label', e.target.value)}
                                />
                            </div>
                            <div className="input-group" style={{ marginTop: '15px' }}>
                                <label>Node Size</label>
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    value={nodeMetadata[inspector.id]?.size || 30}
                                    onChange={(e) => handleUpdateNode(inspector.id, 'size', parseInt(e.target.value))}
                                />
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '15px' }}>
                                Renaming here updates all connected views including 4D Omni.
                            </div>
                        </div>
                    )}
                    {!inspector.type && (
                        <div className="global-actions">
                            <div className="section-title">GRAPH ACTIONS</div>
                            <button className="reset-layout-btn" onClick={handleResetPositions}>
                                <RotateCcw size={14} /> Reset to Default Layout
                            </button>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '15px' }}>
                                This restores all factors to their original circular reference positions.
                            </div>
                            {/* Variable Mapping Legend */}
                            {nodes.get().length > 0 && (
                                <>
                                    <div className="section-title" style={{ marginTop: '20px' }}>VARIABLE MAPPING</div>
                                    <div className="mapping-list">
                                        {/* Table Header */}
                                        <div className="mapping-item header" style={{ background: 'transparent', borderBottom: `1px solid ${colors.border}`, borderRadius: 0, marginBottom: '5px' }}>
                                            <span className="mapping-badge" style={{ visibility: 'hidden' }}>0</span>
                                            <span className="mapping-name" style={{ fontWeight: 700, color: colors.accent }}>Original Column</span>
                                            <span className="mapping-unit" style={{ fontWeight: 700, color: colors.accent, width: '80px', textAlign: 'right' }}>Unit</span>
                                        </div>
                                        {nodes.get().map((n, idx) => {
                                            const mapped = nodeMapping.find(m => String(m.name) === String(n._fullName || n.id));
                                            return (
                                                <div key={n.id} className="mapping-item">
                                                    <span className="mapping-badge">{n._index || idx + 1}</span>
                                                    <span className="mapping-name" title={n._fullName || n.id}>{n._fullName || n.id}</span>
                                                    <span className="mapping-unit" style={{ fontSize: '10px', color: colors.textSecondary, width: '80px', textAlign: 'right' }}>
                                                        {mapped?.unit || '-'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className={`toast ${toast.show ? 'show' : ''}`}>{toast.msg}</div>
        </div>
    );
};

export default CausalGraphViewer;
