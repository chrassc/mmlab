var gVarTest;

//initialize new Naver Map to div #map
var map = new naver.maps.Map("map", {
    center: new naver.maps.LatLng(36.55753, 127.75409),
    zoom: 7,
    mapTypeControl: true,
    zoomControl: true,
    zoomControlOptions: {
        position: naver.maps.Position.TOP_LEFT,
        style: naver.maps.ZoomControlStyle.SMALL
    }
})
//markers and info windows that display information when markers are clicked (see attachInfoToMarkers())
var markers = [];
var infoWindows = [];
//visible area of map from NW to SE. used to find viewable region to display markers (see updateMarkers())
var bounds = map.getBounds();
var northEast = bounds.getNE();
var southWest = bounds.getSW();
var lngSpan = northEast.lng() - southWest.lng();
var latSpan = northEast.lat() - southWest.lat();

//adds event listener to update markers on the map upon changes to map
naver.maps.Event.addListener(map, 'idle', function () { updateMarkers(map, markers); });

//receives markers from markers array and updates on map
function updateMarkers(map, markers) {
    let marker;
    let position;
    let i = 0;
    for (let i = 0; i < markers.length; i++) {
        marker = markers[i];
        position = marker.getPosition();
        if (bounds.hasLatLng(position)) {
            showMarker(map, marker);
        }
        else {
            hideMarker(map, marker);
        }
    }
}
//see fx updateMarkers
function showMarker(map, marker) {
    if (marker.setMap()) return;
    marker.setMap(map);
}
//see fx updateMarkers
function hideMarker(map, marker) {
    if (!marker.setMap()) return;
    marker.setMap(null);
}
// Return an event handler storing the marker index as a closure variable named seq.
function getClickHandler(seq) {
    return function (e) {
        var marker = markers[seq],
            infoWindow = infoWindows[seq];

        if (infoWindow.getMap()) {
            infoWindow.close();
        } else {
            infoWindow.open(map, marker);
        }
    }
}

//assign each marker with its respective infoWindow
function attachInfoToMarkers() {
    for (let i = 0; i < markers.length; i++) {
        naver.maps.Event.addListener(markers[i], 'click', getClickHandler(i));
    }
}
//START of AJAX code
//used to store final object-array of all ajax calls disaster call + each iterated Naver MAPS geocacher call)
var info = [];

var ajaxData = {
    disaster: {
        url: "http://apis.data.go.kr/1741000/DisasterMsg2/getDisasterMsgList",
        data: {
            "ServiceKey": "aN2aOKkivRPAL7ZlAtz6BKj/QcSYUvEvZVRk80qX0cTYMUEUAiGIx+slDNoLo1feNuxD6cSBgSaMO3B6tp/Zvw==",
            "pageNo": "1",
            "numOfRows": "100",
            "type": "JSON",
            "flag": "Y"
        }
    },
    geocacher: {
        url: "https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode",
        data: {
            "X-NCP-APIGW-API-KEY-ID": "8l1v1v8ltg",
            "X-NCP-APIGW-API-KEY": "h54A6C6Ndio4LYulVxT2FGYaGCiD3QjwH8l91sQU",
            "query": ""
        }
    }
}


//variable to init AJAX calls with url and header, returns a promise
var ajaxCall = function (url, data) {
    return $.ajax({
        url: url,
        data: data,
        success: function () {
            ajaxCallCounter();
        },
        error: function () {
            ajaxCallCounter();
        }
    })
}

//count ajax calls that have returned values and set requestComplete variable to true if total returns == total calls
var callCount;
function ajaxCallCounter() {
    callCount += 1;
    if (callCount == ajaxData.disaster.data.numOfRows) {
        requestComplete = true;
        infoToMarkers();
    }
}

//variable to signal that all ajax calls complete (CURRENTLY NONFUNCTIONAL)
var requestComplete = false;


//main function to send query with each successive ajax requests/table updates/map updates
window.onload = sendQuery();
function sendQuery() {
    //reset existing info
    callCount = -1; //-1 to omit the disaster call
    info = []
    document.getElementById("button").innerText = "Please Wait...";
    let timer = 30;
    requestComplete = false;
    let countDown = setInterval(function () {
        document.getElementById("countdown").innerHTML = timer;
        if (timer <= 0 || requestComplete == true) {
            clearInterval(countDown);
            document.getElementById("countdown").innerHTML = 0;
        }
        timer -= 1;
    }, 1000);
    let getDisaster = ajaxCall(ajaxData.disaster.url, ajaxData.disaster.data);
    $.when(getDisaster).then(updateFromDisasterResult);;
}

//function upon promise return from Disaster ajax call
//update table to show line items in reverse chronological order
//call function to append the main info variable with the original disasterResult JSON in addition to coordinates using ajax calls to Naver MAPS Geocacher
function updateFromDisasterResult(getDisasterResult) {
    //disaster returns as JSON string, must parse
    let disasterInfo = JSON.parse(getDisasterResult).DisasterMsg[1].row;
    updateTable(disasterInfo);
    for (let i = 0; i < disasterInfo.length; i++) {
        //init a variable to do ajax call for each result
        let tempAjaxGeo = ajaxData.geocacher;
        let query = JSON.parse(JSON.stringify(disasterInfo[i].location_name).replace("전체", ""));
        tempAjaxGeo.data.query = query;
        console.log(tempAjaxGeo.data.query);
        let getGeocache = ajaxCall(tempAjaxGeo.url, tempAjaxGeo.data);
        //final format to eventually output to info
        let finalObj = {
            create_date: disasterInfo[i].create_date,
            location_name: disasterInfo[i].location_name,
            msg: disasterInfo[i].msg,
            lat: 0,
            lng: 0
        };
        //upon retrieval of geocache result promise, push to main info array (see updateFromDisasterResult)
        $.when(getGeocache).then(function (getGeocacheResult) {
            finalObj.lat = getGeocacheResult.addresses[0].y;
            finalObj.lng = getGeocacheResult.addresses[0].x;
            info.push(finalObj);
        });
    }
}

//update the table with new values with each successive sendQuery(), called at updateFromDisasterResult()
function updateTable(disasterInfo) {
    //upon successful retrieval of disaster data, reset table
    document.getElementById("table").removeChild(document.getElementById("table").children[1]);
    document.getElementById("table").appendChild(document.createElement("tbody"));
    document.getElementById("button").innerText = "Resend Query";
    for (let i = 0; i < disasterInfo.length; i++) {
        let tBodyRef = document.getElementById("table").getElementsByTagName("tbody")[0];
        let row = tBodyRef.insertRow();
        let cell1 = row.insertCell(0);
        let cell2 = row.insertCell(1);
        let cell3 = row.insertCell(2);
        cell1.innerHTML = disasterInfo[i].create_date;
        cell2.innerHTML = disasterInfo[i].location_name;
        cell3.innerHTML = disasterInfo[i].msg;
    }
}

//uses main info array to create markers on map with infoWindow
function infoToMarkers() {
    for (let i = 0; i < info.length; i++) {
        let mark = info[i];
        let latlng = new naver.maps.LatLng(mark.lat, mark.lng);
        let marker = new naver.maps.Marker({
            position: latlng,
            draggable: false
        });
        let infoWindow = new naver.maps.InfoWindow({
            content: "<div style=width:300px;text-align:center;padding:0px;><div><b>Location: </b>" + mark.location_name + "</div><div><b>Date/Time: </b>" + mark.create_date + "</div><div><b>Message: </b>" + mark.msg + "<div></div>",
        });
        markers.push(marker);
        infoWindows.push(infoWindow);
    }
    attachInfoToMarkers();
    map.refresh();
}