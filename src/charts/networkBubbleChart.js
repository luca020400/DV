import * as d3 from "d3";

import { createResponsiveSvg, getContainerDimensions } from '../utils/chart.js';
import { createUnigeOrdinalScale } from '../utils/palette.js';

export function renderNetworkBubbleChart(container, data, margins) {
    const { width, height } = getContainerDimensions(container);

    // Clear previous content
    container.innerHTML = "";

    // Ensure container has relative positioning for tooltips
    container.style.position = "relative";

    // Inner dimensions
    const innerWidth = Math.max(100, width - margins.left - margins.right);
    const innerHeight = Math.max(100, height - margins.top - margins.bottom);

    // Transform data into bubble chart format
    // Create a hierarchical structure: Root -> Countries -> Event Types -> Events
    const countries = Array.from(new Set(data.map(d => d.country)));
    const eventTypes = Array.from(new Set(data.map(d => d.eventType))).sort();

    // Build hierarchical data
    // Root node contains countries as children
    // Each country contains event types as children
    // Event types contain the aggregated event values
    const hierarchyData = {
        name: "root",
        children: countries.map(country => {
            const countryData = data.filter(d => d.country === country);
            const eventTypeMap = new Map();
            
            countryData.forEach(item => {
                if (!eventTypeMap.has(item.eventType)) {
                    eventTypeMap.set(item.eventType, 0);
                }
                eventTypeMap.set(item.eventType, eventTypeMap.get(item.eventType) + item.events);
            });

            return {
                name: country,
                category: "country",
                children: Array.from(eventTypeMap.entries()).map(([eventType, events]) => ({
                    name: eventType,
                    category: "event",
                    value: events
                }))
            };
        })
    };

    // Create SVG with large canvas for bubble layout
    const canvasHeight = Math.max(height, 1000);
    const svg = createResponsiveSvg(width, canvasHeight);

    // Main group with margins
    const g = svg.append("g")
        .attr("transform", `translate(${margins.left},${margins.top})`);

    // Create hierarchy and compute bubble layout
    const root = d3.hierarchy(hierarchyData)
        .sum(d => d.value || 0)
        .sort((a, b) => b.value - a.value);

    const pack = d3.pack()
        .size([innerWidth, canvasHeight - margins.top - margins.bottom])
        .padding(3);

    const packedRoot = pack(root);
    const leaves = packedRoot.leaves();
    const nodes = packedRoot.descendants();

    // Create color scales
    const countryColorScale = createUnigeOrdinalScale()
        .domain(countries);

    const eventColorScale = createUnigeOrdinalScale()
        .domain(eventTypes);

    // Tooltip
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

    // Selection state for filtering
    let selectedFilter = { category: null, name: null };

    // Draw country-level circles (big bubbles for states)
    const countryNodes = nodes.filter(d => d.depth === 1 && d.children);
    
    const countryCircles = g.selectAll(".country-circle")
        .data(countryNodes)
        .enter()
        .append("circle")
        .attr("class", "country-circle")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => d.r)
        .attr("fill", d => countryColorScale(d.data.name))
        .attr("opacity", 0.15)
        .attr("stroke", d => countryColorScale(d.data.name))
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .style("pointer-events", "none");

    // Draw circles for all event nodes
    const circles = g.selectAll("circle.event-circle")
        .data(leaves)
        .enter()
        .append("circle")
        .attr("class", "event-circle")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => d.r)
        .attr("fill", d => {
            const eventType = d.data.name;
            return eventColorScale(eventType);
        })
        .attr("opacity", 0.7)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .style("cursor", "pointer");

    // Add hover interactions
    circles
        .on("mouseenter", function (event, d) {
            d3.select(this)
                .attr("stroke-width", 3)
                .attr("opacity", 0.95);
        })
        .on("mousemove", function (event, d) {
            const country = d.parent.data.name;
            const eventType = d.data.name;
            const events = d.data.value;
            const [mx, my] = d3.pointer(event, container);
            tooltip.style("display", "block")
                .style("left", `${mx + 12}px`)
                .style("top", `${my + 12}px`)
                .html(`<strong>${country}</strong><br/><strong>${eventType}</strong><br/>Events: <strong>${events}</strong>`);
        })
        .on("mouseleave", function (event, d) {
            d3.select(this)
                .attr("stroke-width", 1.5)
                .attr("opacity", 0.7);
            tooltip.style("display", "none");
        })
        .on("click", function (event, d) {
            event.stopPropagation();
            
            const country = d.parent.data.name;
            const category = "country";

            // Toggle: if same filter -> clear
            if (selectedFilter.category === category && selectedFilter.name === country) {
                selectedFilter = { category: null, name: null };
                circles
                    .attr("opacity", 0.7)
                    .attr("stroke-width", 1.5);
                return;
            }

            // Set new filter
            selectedFilter = { category, name: country };

            // Highlight circles from selected country
            circles
                .attr("opacity", c => {
                    const circleCountry = c.parent.data.name;
                    return circleCountry === country ? 0.95 : 0.2;
                })
                .attr("stroke-width", c => {
                    const circleCountry = c.parent.data.name;
                    return circleCountry === country ? 3 : 1.5;
                });
        });

    // Add labels to larger bubbles
    g.selectAll("text")
        .data(leaves.filter(d => d.r > 20))
        .enter()
        .append("text")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "500")
        .attr("fill", "#333")
        .style("pointer-events", "none")
        .text(d => {
            const label = d.data.name;
            return label.length > 12 ? label.slice(0, 10) + "…" : label;
        });

    // Add country labels to country groupings (larger bubbles showing aggregated country data)
    g.selectAll(".country-label")
        .data(countryNodes)
        .enter()
        .append("text")
        .attr("class", "country-label")
        .attr("x", d => d.x)
        .attr("y", d => d.y - d.r - 10)
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .attr("font-weight", "700")
        .attr("fill", d => countryColorScale(d.data.name))
        .style("pointer-events", "none")
        .text(d => d.data.name);

    // Allow clicking background to clear selection
    svg.on("click", () => {
        selectedFilter = { category: null, name: null };
        circles
            .attr("opacity", 0.7)
            .attr("stroke-width", 1.5);
    });

    // Append SVG to container
    container.appendChild(svg.node());
}
