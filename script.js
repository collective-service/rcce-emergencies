const geodataUrl = 'world.json';
const reliefWebApiURL = 'https://api.reliefweb.int/v1/disasters?appname=rwint-user-0&profile=list&preset=latest&slim=1';

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
            "types": [...fields.type]
        })
    });

    return dataArr;
}

const isMobile = $(window).width() < 767 ? true : false;

const viewportWidth = window.innerWidth;
let currentZoom = 1;

const mapFillColor = '#204669',
    mapInactive = '#fff',
    mapActive = '#D90368',
    hoverColor = '#D90368';

let g, mapsvg, projection, width, height, zoom, path;
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
        // .attr("fill", "#99daea");
        .attr("fill", "#d9d9d9");

    emergenciesData.forEach(element => {
        countriesISO3Arr.includes(element.iso3) ? null : countriesISO3Arr.push(element.iso3);
    });

    g = mapsvg.append("g").attr('id', 'countries')
        .selectAll("path")
        .data(geomData.features)
        .enter()
        .append("path")
        .attr('d', path)
        .attr('id', function(d) {
            return d.properties.countryIso3Code;
        })
        .attr('class', function(d) {
            var className = (countriesISO3Arr.includes(d.properties.ISO_A3)) ? 'hasEmergency' : 'inactive';
            return className;
        })
        .attr('fill', function(d) {
            return countriesISO3Arr.includes(d.properties.ISO_A3) ? mapFillColor : mapInactive;
        })
        .attr('stroke-width', .2)
        .attr('stroke', '#d9d9d9');

    mapsvg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);

    //map tooltips
    var maptip = d3.select('#map').append('div').attr('class', 'd3-tip map-tip hidden');

    //zoom controls
    d3.select("#zoom_in").on("click", function() {
        zoom.scaleBy(mapsvg.transition().duration(500), 1.5);
    });
    d3.select("#zoom_out").on("click", function() {
        zoom.scaleBy(mapsvg.transition().duration(500), 0.5);
    });

    g.filter('.hasEmergency')
        .on("mousemove", function(d) {
            if (!$(this).hasClass('clicked')) {
                $(this).attr('fill', hoverColor);
            }
            const countryInfo = emergenciesData.filter((c) => { return c.iso3 == d.properties.ISO_A3 })[0];
            const infos = countryInfo.country +
                '<br>' +
                countryInfo.emergency;
            var mouse = d3.mouse(mapsvg.node()).map(function(d) { return parseInt(d); });
            maptip
                .classed('hidden', false)
                .attr('style', 'left:' + (mouse[0]) + 'px; top:' + (mouse[1] + 25) + 'px')
                .html(infos);

        })
        .on("mouseout", function(d) {
            if (!$(this).hasClass('clicked')) {
                $(this).attr('fill', mapFillColor);
            }
            maptip.classed('hidden', true);
        });

} //initiateMap


function showMapTooltip(d, maptip, text) {
    var mouse = d3.mouse(mapsvg.node()).map(function(d) { return parseInt(d); });
    maptip
        .classed('hidden', false)
        .attr('style', 'left:' + (mouse[0] + 20) + 'px;top:' + (mouse[1] + 20) + 'px')
        .html(text)
}

function hideMapTooltip(maptip) {
    maptip.classed('hidden', true)
}

// zoom on buttons click
function zoomed() {
    const { transform } = d3.event;
    currentZoom = transform.k;

    if (!isNaN(transform.k)) {
        g.attr("transform", transform);
        g.attr("stroke-width", 1 / transform.k);

    }
}

function getEmergencyInfo(iso) {

}