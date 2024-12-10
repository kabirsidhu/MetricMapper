const mapWidth = 960, mapHeight = 600;

const svg = d3.select("#map").append("svg")
    .attr("width", mapWidth)
    .attr("height", mapHeight);

const tooltip = d3.select("#tooltip");

// Define metric-specific year ranges
const metricYears = {
    "GDP": ["2018", "2019", "2020", "2021"],
    "GDP per Capita": ["2018", "2019", "2020", "2021"],
    "Health Expenditure (% GDP)": ["2014", "2015", "2016", "2017", "2018", "2019", "2020"],
    "Health Expenditure per Person": ["2018", "2019"],
    "Unemployment (%)": ["2018", "2021"],
    "Military Spending": ["2021"]
};

let selectedMetric = "GDP";
let baselineCountry = "United States";
let selectedYear = "2021";

// Load data and map
Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
    d3.csv("clean_data.csv", d => ({
        Country: d.Country,
        Year: d.Year,
        Metric: d.Metric,
        MetricValue: +d["Metric Value"] // Parse metric values as numbers
    }))
]).then(([world, data]) => {
    const countries = topojson.feature(world, world.objects.countries).features;

    // Populate dropdowns
    const uniqueCountries = [...new Set(data.map(d => d.Country))];
    const baselineDropdown = d3.select("#baselineCountry");
    const yearDropdown = d3.select("#yearSelect");

    baselineDropdown.selectAll("option")
        .data(uniqueCountries)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);

    // Function to update year dropdown based on selected metric
    function updateYearDropdown(metric) {
        const availableYears = metricYears[metric];
        yearDropdown.selectAll("option").remove();
        
        yearDropdown.selectAll("option")
            .data(availableYears)
            .enter()
            .append("option")
            .attr("value", d => d)
            .text(d => d);

        // Set default year to first available year
        selectedYear = availableYears[0];
        yearDropdown.property("value", selectedYear);
    }

    // Draw map
    const projection = d3.geoNaturalEarth1()
        .scale(150)
        .translate([mapWidth / 2, mapHeight / 2]);

    const path = d3.geoPath().projection(projection);

    svg.selectAll("path")
        .data(countries)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#ccc")
        .attr("stroke", "#333")
        .on("mouseover", function(event, d) {
            const countryName = d.properties.name;
            const countryData = data.find(e => 
                e.Country === countryName && 
                e.Metric === selectedMetric && 
                e.Year === selectedYear
            );
            const baselineData = data.find(e => 
                e.Country === baselineCountry && 
                e.Metric === selectedMetric && 
                e.Year === selectedYear
            );

            if (countryData || baselineData) {
                tooltip.select("#tooltip-country").text(countryName);
                tooltip.select("#tooltip-value").html(`
                    Year: ${selectedYear}<br>
                    Hovered Country Value: ${countryData ? countryData.MetricValue : "N/A"}<br>
                    Baseline Country (${baselineCountry}) Value: ${baselineData ? baselineData.MetricValue : "N/A"}
                `);
                tooltip
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY + 5) + "px")
                    .classed("hidden", false)
                    .classed("visible", true);
            }
        })
        .on("mouseout", function() {
            tooltip.classed("hidden", true).classed("visible", false);
        });

    // Update map based on dropdown changes
    function updateMap() {
        selectedMetric = d3.select("#metricSelect").property("value");
        baselineCountry = d3.select("#baselineCountry").property("value");
        selectedYear = d3.select("#yearSelect").property("value");

        const baselineData = data.find(d => 
            d.Country === baselineCountry && 
            d.Metric === selectedMetric && 
            d.Year === selectedYear
        );
        const baselineValue = baselineData ? baselineData.MetricValue : null;

        svg.selectAll("path")
            .attr("fill", d => {
                const countryName = d.properties.name;
                const countryData = data.find(e => 
                    e.Country === countryName && 
                    e.Metric === selectedMetric && 
                    e.Year === selectedYear
                );

                if (countryData) {
                    const value = countryData.MetricValue;
                    if (value && baselineValue !== null) {
                        return value > baselineValue ? "green" : "red";
                    }
                }
                return "#ccc";
            });
    }

    // Show temporal trends
    function showTrends() {
        const trendData = data.filter(d => 
            d.Metric === selectedMetric && 
            d.Country === baselineCountry &&
            metricYears[selectedMetric].includes(d.Year)
        );

        // Remove existing chart
        d3.select("#trend-chart").remove();

        // Create trend chart
        const margin = {top: 20, right: 30, bottom: 30, left: 50};
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svgTrend = d3.select("#map")
            .append("svg")
            .attr("id", "trend-chart")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scalePoint()
            .domain(metricYears[selectedMetric])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(trendData, d => d.MetricValue)])
            .range([height, 0]);

        svgTrend.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svgTrend.append("g")
            .call(d3.axisLeft(y));

        svgTrend.append("path")
            .datum(trendData)
            .attr("fill", "none")
            .attr("stroke", "blue")
            .attr("stroke-width", 2)
            .attr("d", d3.line()
                .x(d => x(d.Year))
                .y(d => y(d.MetricValue))
            );

        svgTrend.selectAll(".dot")
            .data(trendData)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.Year))
            .attr("cy", d => y(d.MetricValue))
            .attr("r", 4)
            .attr("fill", "blue");
    }

    // Attach event listeners
    d3.select("#metricSelect").on("change", () => {
        const newMetric = d3.select("#metricSelect").property("value");
        updateYearDropdown(newMetric);
        updateMap();
        showTrends();
    });

    d3.select("#baselineCountry").on("change", () => {
        updateMap();
        showTrends();
    });

    d3.select("#yearSelect").on("change", updateMap);

    // Initial rendering
    updateYearDropdown(selectedMetric);
    updateMap();
    showTrends();
});