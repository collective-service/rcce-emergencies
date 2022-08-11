const geodataUrl = 'world.json';
const reliefWebApiURL = 'https://api.reliefweb.int/v1/disasters?appname=rwint-user-0&profile=list&preset=latest&fields[include][]=description';
//https://api.reliefweb.int/v1/disasters?appname=rwint-user-0&profile=list&preset=latest&fields[include][]=description
//https://api.reliefweb.int/v1/disasters?appname=rwint-user-0&profile=list&preset=latest&slim=1
const api_setup_url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTO4an4g3FxrhfbVptaxEB3GL7Gr3h3NMJOzZVyaJPslsFuXGJqYvQVkiawcXE6jXdi_uOB14cMQJxY/pub?gid=2020692436&single=true&output=csv';
const colorsMappingURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTO4an4g3FxrhfbVptaxEB3GL7Gr3h3NMJOzZVyaJPslsFuXGJqYvQVkiawcXE6jXdi_uOB14cMQJxY/pub?gid=0&single=true&output=csv';
const countriesListURL = 'https://raw.githubusercontent.com/collective-service/cs-kobo-scraper/main/data/countries_list_iso.csv';

let geomData,
    emergenciesData,
    colorsMappingArr,
    countriesISO3Dict;
let legendEntries = [],
    worldwideLegendArr = [];

// Api parameters
const limit = 150;
let api_start_date = new Date("2022-01-01");
let api_excludes_emergencies = [];
let allCountriesList = [];

$(document).ready(function() {
    function getData() {
        Promise.all([
            d3.json(geodataUrl),
            d3.json(reliefWebApiURL + "&limit=" + limit),
            d3.csv(colorsMappingURL),
            d3.csv(api_setup_url),
            d3.csv(countriesListURL)
        ]).then(function(data) {
            geomData = topojson.feature(data[0], data[0].objects.geom);
            var exArr = [];
            data[3].forEach(setup => {
                const val = setup.value;
                if (setup.key == "api_start_date") {
                    if (val != undefined) {
                        api_start_date = new Date(val);
                    }
                }

                if (setup.key == "api_excludes_emergencies" && val != "") {
                    exArr = val.split(',');
                    exArr.forEach(ele => {
                        api_excludes_emergencies.includes(ele) ? null :
                            api_excludes_emergencies.push(ele);
                    });
                }
                if (setup.key == "legend_worldwide") {
                    worldwideLegendArr.push(val)
                }
            });
            countriesISO3Dict = data[4];

            emergenciesData = api_cleanedOngoingDisasters(data[1].data);

            colorsMappingArr = data[2];

            colorsMappingArr.forEach(element => {
                legendEntries.includes(element["Legend item"]) ? null : legendEntries.push(element["Legend item"]);
            });

            //remove loader and show vis
            $('.loader').hide();
            $('#main').css('opacity', 1);

            initiateMap();
        }); // then
    } // getData

    getData();
});

function setDepth(iso3) {
    var depth = 0;
    if (!allCountriesList.includes(iso3)) {
        return 0;
    } else {
        var count = 0;
        allCountriesList.forEach(ctry => {
            ctry == iso3 ? count += 1 : null;
        });
        depth = count;
    }
    return depth;
}

function getCountryISO3(country_name) {
    var cleanedName = country_name.split('(')[0].trim();
    for (let index = 0; index < countriesISO3Dict.length; index++) {
        const element = countriesISO3Dict[index];
        if (element.NAME == cleanedName) {
            return element.ISO3;
            break;
        } else {
            if (element.FULL_NAME.includes(country_name)) {
                return element.ISO3;
                break;
            }
        }
    }
} //getCountryISO3

function api_cleanedOngoingDisasters(apiData) {
    let dataArr = []; // id , countryname, iso3, name_emergencies, type=[]
    var api_types_Arr = [];
    // console.log(apiData)
    apiData.forEach(element => {
        // var tArr = element["fields"].type;
        // tArr.forEach(tpe => {
        //     api_types_Arr.includes(tpe.name) ? "" : api_types_Arr.push(tpe.name);
        // });
        // console.log(api_types_Arr)

        if (element["fields"].status != "past" && api_start_date <= new Date(element["fields"].date.created) && !api_excludes_emergencies.includes(element["fields"].name)) {
            // console.log(element)
            const fields = element["fields"];
            var types = [];
            fields.type.forEach(t => {
                types.push(t.name);
            })
            cntriesArr = fields.country;
            if (cntriesArr.length == 1) {
                const iso3 = getCountryISO3(fields.country[0].name);
                dataArr.push({
                    "id": element.id,
                    "status": fields.status,
                    "date": new Date(fields.date.created),
                    "country": fields.country[0].name,
                    "iso3": iso3, //fields.glide.split('-')[3],
                    "emergency": fields.name,
                    "types": types,
                    "type_main": fields.type[0].name,
                    "description": fields.description,
                    "x": 0,
                    "y": 0,
                    "depth": setDepth(iso3)
                })
                allCountriesList.push(fields.glide.split('-')[3]);
            } else {
                cntriesArr.forEach(item => {
                    const iso3 = getCountryISO3(item.name);
                    emer = fields.name.split(':')[1];
                    dataArr.push({
                        "id": element.id,
                        "status": fields.status,
                        "date": new Date(fields.date.created),
                        "country": item.name,
                        "iso3": iso3,
                        "emergency": fields.name, //fields.name,item.name + ": " + emer
                        "types": types,
                        "type_main": fields.type[0].name,
                        "description": fields.description,
                        "x": 0,
                        "y": 0,
                        "depth": setDepth(iso3)
                    })
                });
                allCountriesList.push(fields.glide.split('-')[3]);
            }
        }
    });
    // console.log(dataArr)
    return dataArr;
}

function updateLatLon(iso3, x, y) {
    for (let index = 0; index < emergenciesData.length; index++) {
        const element = emergenciesData[index];
        if (element.iso3 == iso3) {
            if (element.depth != 0) {
                console.log("should move this one");
            }
            element.x = x;
            element.y = y;
            break;
        }
    }

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
    var mapScale = (isMobile) ? width / 5.5 : width / 10.1;
    var mapCenter = (isMobile) ? [12, 12] : [25, 25];
    projection = d3.geoMercator()
        .center(mapCenter)
        .scale(mapScale)
        .translate([width / 2.1, height / 1.9]);

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

    //filter the data
    emergenciesData = emergenciesData.filter(function(d) {
        return d.x != 0 && d.y != 0;
    });
    const circlesR = 7;
    const circles = g.append("g")
        .attr("class", "cercles")
        .selectAll(".cercle")
        .data(emergenciesData)
        .enter()
        .append("g")
        .append("circle")
        .attr("class", "cercle")
        .attr("r", circlesR)
        .attr("transform", function(d) {
            // console.log(d)
            // if (d.id = "51018") {
            //     const xx = 0.1;
            //     const yy = 100;
            //     return "translate(" + [d.x + xx, d.y + yy] + ")";
            // }
            return "translate(" + [d.x, d.y] + ")";
        })
        .attr("fill", function(d) { return getColor(d.type_main); })
        .on("mousemove", function(d) {
            mousemove(d);
        })
        .on("mouseout", function() {
            maptip.classed('hidden', true);
        })
        .on("click", function(d) {
            generateEmergencyInfo(d);
            g.selectAll("circle").attr('r', circlesR);
            $(this).attr('r', circlesR * 2);
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

    d3.select('#worldwide').style("left", width / 2 + "px");

    var worldwideSVG = d3.select('#worldwide').append("svg")
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

    // worldwideSVG
    //     .select("g")
    //     .selectAll("text")
    //     // .data(worldwideLegendArr).enter()
    //     .append("text")
    //     .attr("x", 30)
    //     .attr("y", 10)
    //     .text("WorldWide");

    // worldwideSVG.append("g")
    //     .selectAll("legend-item")
    //     .data(worldwideLegendArr)
    //     .enter()
    //     .append("circle").attr("r", 6)
    //     .attr("cx", xcoord)
    //     .attr("cy", function(d, i) {
    //         if (i == 0) {
    //             return xcoord;
    //         }
    //         return xcoord + i * 25;
    //     })
    //     .attr("fill", function(legend) { return getColor("Epidemic"); });

    // worldwideSVG
    //     .select("g")
    //     .selectAll("text")
    //     .data(worldwideLegendArr).enter()
    //     .append("text")
    //     .attr("x", xcoord * 2)
    //     .attr("y", function(d, i) {
    //         if (i == 0) {
    //             return xcoord + 5;
    //         }
    //         return xcoord + 5 + i * 25;
    //     })
    //     .text(function(d) { return d; });
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
    var color = ""; //'#C3C3C3'
    for (let index = 0; index < colorsMappingArr.length; index++) {
        const element = colorsMappingArr[index];
        if (element["RW type"].includes(type)) {
            color = element.Color;
            break;
        }
    }

    return color;
}