figma.showUI(__html__, {width: 400, height: 280});

const postSourceCode = () => {
    const selection = figma.currentPage.selection;
    if (selection.length !== 0) {
        const source = selection[0].getPluginData('source');

        if (source) {
            // Element exists, always detect scale by comparing with fresh generation
            figma.ui.postMessage({
                type: 'generate-for-scale-detection',
                source: source,
                currentWidth: selection[0].width,
                currentHeight: selection[0].height,
            });
        }
    }
};
postSourceCode();

figma.ui.onmessage = msg => {
    if (msg.type === 'create-latex-svg') {
        const node = figma.createNodeFromSvg(msg.svg);
        if (node.children.length !== 0) {
            const svg = <GroupNode>node.children[0];
            const selection = figma.currentPage.selection;
            (svg as any).setRelaunchData({edit: ''});
            if (selection.length !== 0 && selection[0].getPluginData('source') != '') {
                const groupNode = <GroupNode>selection[0];
                groupNode.setPluginData('source', msg.source);
                groupNode.name = msg.source;
                svg.x = groupNode.x;
                svg.y = groupNode.y;

                // Apply the scale by resizing (like Figma's baked scaling)
                if (msg.scale !== 1) {
                    svg.resize(svg.width * msg.scale, svg.height * msg.scale);
                }

                groupNode.appendChild(svg.children[0]);
                groupNode.children[0].remove();
                figma.currentPage.selection = [groupNode];
            } else {
                svg.setPluginData('source', msg.source);
                svg.name = msg.source;
                const {x, y} = figma.viewport.center;
                svg.x = x;
                svg.y = y;

                // Apply the scale by resizing (like Figma's baked scaling)
                if (msg.scale !== 1) {
                    svg.resize(svg.width * msg.scale, svg.height * msg.scale);
                }

                figma.currentPage.appendChild(svg);
                figma.currentPage.selection = [svg];
            }
        }
        node.remove();
    } else if (msg.type === 'generate-for-scale-detection') {
        // Generate a fresh Figma group to compare dimensions
        const node = figma.createNodeFromSvg(msg.svg);
        if (node.children.length !== 0) {
            const freshGroup = <GroupNode>node.children[0];
            const freshWidth = freshGroup.width;
            const freshHeight = freshGroup.height;

            // Calculate scale by comparing Figma group dimensions
            const scaleX = msg.currentWidth / freshWidth;
            const scaleY = msg.currentHeight / freshHeight;
            const detectedScale = (scaleX + scaleY) / 2;

            // Clean up the temporary node
            node.remove();

            // Send the detected scale back to UI with debug info
            figma.ui.postMessage({
                type: 'scale-detected',
                scale: detectedScale,
                source: msg.source,
                debug: {
                    currentWidth: msg.currentWidth,
                    currentHeight: msg.currentHeight,
                    freshWidth: freshWidth,
                    freshHeight: freshHeight,
                    scaleX: scaleX,
                    scaleY: scaleY,
                    detectedScale: detectedScale,
                },
            });
        }
    }

    if (msg.type !== 'generate-for-scale-detection') {
        figma.closePlugin();
    }
};
