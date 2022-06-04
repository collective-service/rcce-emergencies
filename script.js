const geodataUrl = 'world.json';
const reliefWebApiURL = 'https://api.reliefweb.int/v1/disasters?appname=rwint-user-0&profile=list&preset=latest&fields[include][]=description';
//https://api.reliefweb.int/v1/disasters?appname=rwint-user-0&profile=list&preset=latest&fields[include][]=description
//https://api.reliefweb.int/v1/disasters?appname=rwint-user-0&profile=list&preset=latest&slim=1

let geomData,
    emergenciesData;

$(document).ready(function() {
    function getData() {
        Promise.all([
            d3.json(geodataUrl),
            d3.json(reliefWebApiURL),
        ]).then(function(data) {
            geomData = topojson.feature(data[0], data[0].objects.geom);

            emergenciesData = api_cleanedOngoingDisasters(data[1].data);

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
        dataArr.push({
            "id": element.id,
            "country": fields.country[0].name,
            "iso3": fields.glide.split('-')[3],
            "emergency": fields.name,
            "types": [...fields.type],
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
    width = viewportWidth;
    height = (isMobile) ? 400 : 500;
    var mapScale = (isMobile) ? width / 3.5 : width / 10.6;
    var mapCenter = (isMobile) ? [12, 12] : [25, 25];

    projection = d3.geoMercator()
        .center(mapCenter)
        .scale(mapScale)
        .translate([width / 3.0, height / 1.9]);

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
        .attr('stroke-width', 0)
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
        .attr("r", 5)
        .attr("transform", function(d) { return "translate(" + [d.x, d.y] + ")"; })
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

} //initiateMap

function mousemove(d) {
    let countryName = (d.hasOwnProperty('properties')) ? d.properties.NAME : d.country;
    const html = countryName +
        '<br>' + "(click for more info)";
    maptip
        .classed('hidden', false)
        .attr('style', 'left:' + (d3.event.pageX + 10) + 'px; top:' + (d3.event.pageY) + 'px')
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