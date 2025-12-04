import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';

export function renderSankeyChart(container, data, margins) {
    const { width } = getContainerDimensions(container);

    // Clear previous content
    container.innerHTML = "";
    
    // Ensure container has relative positioning for tooltips
    container.style.position = "relative";

    // Inner dimensions
    const innerWidth = Math.max(100, width - margins.left - margins.right);

    // Transform data into Sankey format
    // Nodes: Countries on the left, Event Types on the right
    const countries = Array.from(new Set(data.map(d => d.country))).sort();
    const eventTypes = Array.from(new Set(data.map(d => d.eventType))).sort();
    
    // Calculate height based on the axis with more nodes
    const maxNodes = Math.max(countries.length, eventTypes.length);
    const minNodeHeight = 20;
    const nodePadding = 15;
    
    // Calculate total height based on max nodes
    const sankeyHeight = maxNodes * minNodeHeight + (maxNodes - 1) * nodePadding;
    const totalHeight = sankeyHeight + margins.top + margins.bottom;

    // Create the SVG with calculated height
    const svg = createResponsiveSvg(width, totalHeight);

    const nodes = [
        ...countries.map((c, i) => ({ id: `country-${c}`, name: c, category: "country" })),
        ...eventTypes.map((e, i) => ({ id: `event-${e}`, name: e, category: "event" }))
    ];

    const links = data.map(d => ({
        source: nodes.findIndex(n => n.id === `country-${d.country}`),
        target: nodes.findIndex(n => n.id === `event-${d.eventType}`),
        value: d.events
    }));

    // Create Sankey generator
    const sankeyGenerator = sankey()
        .nodeWidth(20)
        .nodePadding(nodePadding)
        .nodeSort(null)
        .extent([[0, 0], [innerWidth, sankeyHeight]]);

    const { nodes: sankeyNodes, links: sankeyLinks } = sankeyGenerator({
        nodes: nodes.map(d => ({ ...d })),
        links: links.map(d => ({ ...d }))
    });

    // Create color scale for countries
    const colorScale = d3.scaleOrdinal()
        .domain(countries)
        .range(d3.schemeSet3);

    // Main group with margins
    const g = svg.append("g")
        .attr("transform", `translate(${margins.left},${margins.top})`);

    // Draw links (paths) with better visibility
    const linkGroup = g.append("g")
        .selectAll("path")
        .data(sankeyLinks)
        .enter()
        .append("path")
        .attr("d", sankeyLinkHorizontal())
        .attr("stroke", d => {
            const sourceName = d.source.name;
            return colorScale(sourceName);
        })
        .attr("stroke-opacity", 0.5)
        .attr("fill", "none")
        .attr("stroke-width", d => Math.max(2, d.width))
        .attr("class", "sankey-link");

    // Draw nodes (rectangles)
    const nodeGroup = g.append("g")
        .selectAll("rect")
        .data(sankeyNodes)
        .enter()
        .append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => {
            if (d.category === "country") {
                return colorScale(d.name);
            } else {
                return "#999";
            }
        })
        .attr("opacity", 0.8)
        .style("cursor", "pointer");

    // Add node hover effect
    nodeGroup
        .on("mouseover", function (event, d) {
            d3.select(this)
                .attr("opacity", 1)
                .attr("stroke", "#000")
                .attr("stroke-width", 2);
        })
        .on("mouseout", function (event, d) {
            d3.select(this)
                .attr("opacity", 0.8)
                .attr("stroke", "none");
        });

    // Add labels for nodes
    const labels = g.append("g")
        .selectAll("text")
        .data(sankeyNodes)
        .enter()
        .append("text")
        .attr("x", d => d.category === "country" ? d.x0 - 10 : d.x1 + 10)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("text-anchor", d => d.category === "country" ? "end" : "start")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "500")
        .text(d => d.name)
        .attr("fill", "#333");

    // Add tooltip
    const tooltip = d3.select(container)
        .append("div")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "rgba(0,0,0,0.75)")
        .style("color", "#fff")
        .style("padding", "6px 8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("display", "none")
        .style("z-index", "1000");

    // Add node tooltips
    nodeGroup
        .on("mousemove", function (event, d) {
            const [mx, my] = d3.pointer(event, container);
            tooltip.style("display", "block")
                .style("left", `${mx + 12}px`)
                .style("top", `${my + 12}px`)
                .html(`<strong>${d.name}</strong>`);
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
        });

    // Add link tooltips
    linkGroup
        .on("mousemove", function (event, d) {
            const source = d.source;
            const target = d.target;
            const [mx, my] = d3.pointer(event, container);
            tooltip.style("display", "block")
                .style("left", `${mx + 12}px`)
                .style("top", `${my + 12}px`)
                .html(`<strong>${source.name}</strong> → <strong>${target.name}</strong><br/>Events: <strong>${d.value}</strong>`);
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
        });

    // Append SVG to container
    container.appendChild(svg.node());
}
