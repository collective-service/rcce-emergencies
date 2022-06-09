const geodataUrl = 'world.json';
const reliefWebApiURL = 'https://api.reliefweb.int/v1/disasters?appname=rwint-user-0&profile=list&preset=latest&fields[include][]=description';
//https://api.reliefweb.int/v1/disasters?appname=rwint-user-0&profile=list&preset=latest&fields[include][]=description
//https://api.reliefweb.int/v1/disasters?appname=rwint-user-0&profile=list&preset=latest&slim=1
const colorsMappingURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTO4an4g3FxrhfbVptaxEB3GL7Gr3h3NMJOzZVyaJPslsFuXGJqYvQVkiawcXE6jXdi_uOB14cMQJxY/pub?gid=0&single=true&output=csv';

let geomData,
    emergenciesData,
    colorsMappingArr;
let legendEntries = [];
$(document).ready(function() {
    function getData() {
        Promise.all([
            d3.json(geodataUrl),
            d3.json(reliefWebApiURL),
            d3.csv(colorsMappingURL)
        ]).then(function(data) {
            geomData = topojson.feature(data[0], data[0].objects.geom);

            emergenciesData = api_cleanedOngoingDisasters(data[1].data);

            colorsMappingArr = data[2];
            colorsMappingArr.forEach(element => {
                legendEntries.includes(element["Legend item"]) ? null : legendEntries.push(element["Legend item"]);
            });
            initiateMap();
            //remove loader and show vis
            $('.loader').hide();
            $('#main').css('opacity', 1);
        }); // then
    } // getData

    getData();
});

function api_cleanedOngoingDisasters(apiData) {
    let dataArr = []; // id , countryname, iso3, name_emergencies, type=[]
    apiData.forEach(element => {
        const fields = element["fields"];
        var types = [];
        fields.type.forEach(t => {
            types.push(t.name);
        })
        dataArr.push({
            "id": element.id,
            "country": fields.country[0].name,
            "iso3": fields.glide.split('-')[3],
            "emergency": fields.name,
            "types": types,
            "type_main": fields.type[0].name,
            "description": fields.description,
            "x": 0,
            "y": 0
        })
    });
    return dataArr;
}

function updateLatLon(iso3, x, y) {
    emergenciesData.forEach(element => {
        if (element.iso3 == iso3) {
            element.x = x;
            element.y = y;
        }
    });
}

const isMobile = $(window).width() < 767 ? true : false;

const viewportWidth = window.innerWidth;
let currentZoom = 1;

const mapFillColor = '#001e3f', //00acee F9F871 294780 6077B5 001e3f
    mapInactive = '#001e3f',
    mapActive = '#D90368',
    hoverColor = '#D90368';

let g, mapsvg, projection, width, height, zoom, path, maptip;
let countriesISO3Arr = [];

function initiateMap() {
    width = document.getElementById("mainOfIframe").offsetWidth; //viewportWidth;
    height = (isMobile) ? 400 : 500;
    var mapScale = (isMobile) ? width / 5.5 : width / 7.2;
    var mapCenter = (isMobile) ? [12, 12] : [25, 25];

    projection = d3.geoMercator()
        .center(mapCenter)
        .scale(mapScale)
        .translate([width / 3.7, height / 1.9]);

    path = d3.geoPath().projection(projection);
    zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", zoomed);


    mapsvg = d3.select('#map').append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(zoom)
        .on("wheel.zoom", null)
        .on("dblclick.zoom", null);

    mapsvg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        // .attr("fill", "#d9d9d9");
        .attr("fill", "#1b365e"); //294780 //1b365e //cdd4d9
    // .attr("fill-opacity", "0.5");

    emergenciesData.forEach(element => {
        countriesISO3Arr.includes(element.iso3) ? null : countriesISO3Arr.push(element.iso3);
    });

    //map tooltips
    maptip = d3.select('#map').append('div').attr('class', 'd3-tip map-tip hidden');

    g = mapsvg.append("g"); //.attr('id', 'countries')
    g.selectAll("path")
        .data(geomData.features)
        .enter()
        .append("path")
        .attr('d', path)
        .attr('id', function(d) {
            return d.properties.countryIso3Code;
        })
        .attr('class', function(d) {
            var className = (countriesISO3Arr.includes(d.properties.ISO_A3)) ? 'hasEmergency' : 'inactive';
            if (className == 'hasEmergency') {
                var centroid = path.centroid(d),
                    x = centroid[0],
                    y = centroid[1];
                updateLatLon(d.properties.ISO_A3, x, y);
            }
            return className;
        })
        .attr('fill', function(d) {
            return countriesISO3Arr.includes(d.properties.ISO_A3) ? mapFillColor : mapInactive;
        })
        .attr('stroke-width', 0.05)
        .attr('stroke', '#fff')
        .on("mousemove", function(d) {
            countriesISO3Arr.includes(d.properties.ISO_A3) ? mousemove(d) : null;
        })
        .on("mouseout", function(d) {

            maptip.classed('hidden', true);
        })
        .on("click", function(d) {
            if (countriesISO3Arr.includes(d.properties.ISO_A3)) {
                const countryInfo = emergenciesData.filter((c) => { return c.iso3 == d.properties.ISO_A3 })[0];
                generateEmergencyInfo(countryInfo);
            }

        });

    const circles = g.append("g")
        .attr("class", "cercles")
        .selectAll(".cercle")
        .data(emergenciesData)
        .enter()
        .append("g")
        .append("circle")
        .attr("class", "cercle")
        .attr("r", 6)
        .attr("transform", function(d) { return "translate(" + [d.x, d.y] + ")"; })
        .attr("fill", function(d) { return getColor(d.type_main); })
        .on("mousemove", function(d) {
            mousemove(d);
        })
        .on("mouseout", function() {
            maptip.classed('hidden', true);
        })
        .on("click", function(d) {
            generateEmergencyInfo(d);
        });

    mapsvg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);

    //zoom controls
    d3.select("#zoom_in").on("click", function() {
        zoom.scaleBy(mapsvg.transition().duration(500), 1.5);
    });
    d3.select("#zoom_out").on("click", function() {
        zoom.scaleBy(mapsvg.transition().duration(500), 0.5);
    });

    var legendSVG = d3.select('#legend').append("svg")
        .attr("widht", "100%")
        .attr("height", "100%");
    const xcoord = 10;
    legendSVG.append("g")
        .selectAll("legend-item")
        .data(legendEntries)
        .enter()
        .append("circle").attr("r", 6)
        .attr("cx", xcoord)
        .attr("cy", function(d, i) {
            if (i == 0) {
                return xcoord;
            }
            return xcoord + i * 25;
        })
        .attr("fill", function(legend) { return getColor(legend); });
    legendSVG
        .select("g")
        .selectAll("text")
        .data(legendEntries).enter()
        .append("text")
        .attr("x", xcoord * 2)
        .attr("y", function(d, i) {
            if (i == 0) {
                return xcoord + 5;
            }
            return xcoord + 5 + i * 25;
        })
        .text(function(d) { return d; });
} //initiateMap

function mousemove(d) {
    var html = "";

    if (d.hasOwnProperty('properties')) {
        const arr = emergenciesData.filter((e) => { return e.iso3 == d.properties.ISO_A3; });
        html = arr[0].emergency;
    } else html = d.emergency;

    var mouse = d3.mouse(mapsvg.node()).map(function(d) { return parseInt(d); });
    maptip
        .classed('hidden', false)
        .attr('style', 'left:' + (mouse[0] + 5) + 'px; top:' + (mouse[1] + 10) + 'px')
        .html(html);
} //mousemove

// zoom on buttons click
function zoomed() {
    const { transform } = d3.event;
    currentZoom = transform.k;

    if (!isNaN(transform.k)) {
        g.attr("transform", transform);
        g.attr("stroke-width", 1 / transform.k);

        // updateCerclesMarkers()
    }
}

function generateEmergencyInfo(filteredData) {
    const text = "<h6>" + filteredData.emergency + "</h6>" +
        filteredData.description;

    $("#emergency_desc").html(text);
}

function getColumnUniqueValues() {
    var values = [];
    for (let index = 0; index < arguments.length; index++) {
        var arr = [];
        values.push(arr);
    }
    emergenciesData.forEach(element => {
        for (let index = 0; index < arguments.length; index++) {
            var arr = element[arguments[index]].split(",");
            var returnArr = values[index];
            var trimedArr = arr.map(x => x.trim());
            trimedArr.forEach(d => {
                returnArr.includes(d.trim()) ? '' : returnArr.push(d.trim());
            });
            values[index] = returnArr;
        }
    });

    return values;
} //getColumnUniqueValues

function getColor(type) {
    var color = '#fff'
    colorsMappingArr.forEach(element => {
        if (element["RW type"].includes(type)) {
            color = element.Color;
        }
    });
    return color;
}