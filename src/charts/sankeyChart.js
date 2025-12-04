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
    const countries = Array.from(new Set(data.map(d => d.country)));
    const eventTypes = Array.from(new Set(data.map(d => d.eventType))).sort();

    // Calculate height based on the axis with more nodes
    const maxNodes = Math.max(countries.length, eventTypes.length);

    // Calculate total height based on max nodes
    const sankeyHeight = Math.max(300, maxNodes * 55);
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
        .nodePadding(5)
        .extent([[0, 0], [innerWidth, sankeyHeight]]);

    const { nodes: sankeyNodes, links: sankeyLinks } = sankeyGenerator({
        nodes: nodes.map(d => ({ ...d })),
        links: links.map(d => ({ ...d }))
    });

    // Create color scale for countries
    const colorScale = d3.scaleOrdinal()
        .domain(countries)
        .range(d3.schemeSet3);

    const eventColorScale = d3.scaleOrdinal()
        .domain(eventTypes)
        .range(d3.schemeSet2);

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
                return eventColorScale(d.name);
            }
        })
        .attr("opacity", 0.8)
        .style("cursor", "pointer");

    // selection state for filtering (either a country or an event)
    let selectedFilter = { category: null, name: null };

    // Add node hover/tooltip handlers (use mouseenter/mouseleave to avoid bubbling issues)
    nodeGroup
        .on("mouseenter", function (event, d) {
            d3.select(this)
                .attr("stroke", "#000")
                .attr("stroke-width", 2);
        })
        .on("mousemove", function (event, d) {
            const [mx, my] = d3.pointer(event, container);
            tooltip.style("display", "block")
                .style("left", `${mx + 12}px`)
                .style("top", `${my + 12}px`)
                .html(`<strong>${d.name}</strong>`);
        })
        .on("mouseleave", function (event, d) {
            d3.select(this)
                .attr("stroke", "none")
                .attr("stroke-width", 0);
            tooltip.style("display", "none");
        })
        .on("click", function (event, d) {
            // prevent svg background handler from immediately clearing selection
            event.stopPropagation();

            const name = d.name;
            const category = d.category; // "country" or "event"

            // toggle: if same filter -> clear
            if (selectedFilter.category === category && selectedFilter.name === name) {
                selectedFilter = { category: null, name: null };
                // reset link & node styles
                linkGroup
                    .attr("stroke-opacity", l => 0.5)
                    .attr("opacity", 1);
                nodeGroup.attr("opacity", 0.8);
                return;
            }

            // set new filter
            selectedFilter = { category, name };

            if (category === "country") {
                // highlight outgoing flows from the country
                linkGroup
                    .attr("stroke-opacity", l => (l.source.name === name ? 0.95 : 0.08))
                    .attr("opacity", l => (l.source.name === name ? 1 : 0.25));
                nodeGroup.attr("opacity", nd => (nd.category === "country" && nd.name === name ? 1 : 0.28));
            } else if (category === "event") {
                // highlight incoming flows to the event type
                linkGroup
                    .attr("stroke-opacity", l => (l.target.name === name ? 0.95 : 0.08))
                    .attr("opacity", l => (l.target.name === name ? 1 : 0.25));
                nodeGroup.attr("opacity", nd => (nd.category === "event" && nd.name === name ? 1 : 0.28));
            }
        });

    // Add labels for nodes (do not capture pointer events so they don't block node mouse events)
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
        .attr("fill", "#333")
        .style("pointer-events", "none");

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

    // allow clicking background to clear selection
    svg.on("click", () => {
        selectedFilter = { category: null, name: null };
        linkGroup
            .attr("stroke-opacity", l => 0.5)
            .attr("opacity", 1);
        nodeGroup.attr("opacity", 0.8);
    });

    // Append SVG to container
    container.appendChild(svg.node());
}
