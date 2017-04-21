'use strict';

/**
 * Resistance events Alexa skill -- code for Lambda application
 * Author: Aaron Strauss
 * License: MIT License
 * Based on Amazon's Skill Kit Sample Favorite Color
 * Thanks to "Resistance Near Me"
 */

/*
 * Basic structure from instructions here: https://github.com/alexa/alexa-skills-kit-sdk-for-nodejs
 */
var Alexa = require('alexa-sdk');

		
exports.handler = function(event, context, callback){
    var alexa = Alexa.handler(event, context);
    if ('undefined' === typeof process.env.DEBUG) {
  		alexa.appId = 'amzn1.ask.skill.d6116c8d-31f0-4cfb-aae6-6f3208bc450a';
		}
    //from https://www.npmjs.com/package/alexa-skill-test
    alexa.registerHandlers(handlers);
    alexa.execute();
};


var handlers = {
    
    'LaunchRequest': function () {
      this.emit(":tell","Welcome to Resistance Events. Try saying Alexa, ask Resistance Events to find the next event near me.");
    },

    'GetEvent': function () {
    	var alex = this;
    	getEvent(alex.event.request.intent, alex.event.context, function(output) {
	        alex.emit(':tell',output);
        })
    },

    'ListEventTypes': function () {
    	var alex = this;
    	listEventTypes(alex.event.request.intent,function(output) {
	        alex.emit(':tell',output);
        })
    },
		'ListOptions': function () {
			this.emit(":tell","You can specify before, after or on a specific date.  Within a certain mile radius.  Search by zip code or by city and state.  You can also narrow by event type.");
    },
		'ListSource': function () {
			this.emit(":tell","Events are provided by resistance near me dot org. This Alexa skill is not affiliated with them.");
    },
    'Unhandled': function () {
			this.emit(":tell","Sorry, I didn't understand that request. Try simplifying or looking at example requests. Also, sometimes I get confused with dates. Try May twenty two instead of May twenty second.");
    },
    'HelpIntent': function () {
			this.emit(":tell","Try saying Alexa, find the next event near me using resist events. Be sure to enable the location permission in your app. The app also lists requests to try out.");
		}
    
 };


/*
 * Uses Node Geocoder to convert city state into lat/lng
 * https://github.com/nchaulet/node-geocoder
 */
 
var NodeGeocoder = require('node-geocoder');

var options = {
  provider: 'google',

  // Optional depending on the providers
  httpAdapter: 'https', // Default
  apiKey: 'AIzaSyDDuecC5haNGt4J7Bd364e94dgEjxTBOb8', // for Mapquest, OpenCage, Google Premier
  formatter: null         // 'gpx', 'string', ...
};
 
var geocoder = NodeGeocoder(options);

/**
 * Events are kept in resistancenearme.org's firebase db
 * Adapted from resistancenearme's code
 */
var firebase = require("firebase");

var config = {
  apiKey: 'AIzaSyDwZ41RWIytGELNBnVpDr7Y_k1ox2F2Heg',
  authDomain: 'townhallproject-86312.firebaseapp.com',
  databaseURL: 'https://townhallproject-86312.firebaseio.com',
  storageBucket: 'townhallproject-86312.appspot.com',
  messagingSenderId: '208752196071'
};


firebase.initializeApp(config);
var firebasedb = firebase.database();

/**
 * The following functions grab the value of user options. Options include:
 * Date and BeforeOnAfter: the date that the event should be before/on/after
 * NextOrNearest: Should Alexa return the next event chronologically? or the nearest event geographically?
 *    Default is "next" event chronologically.
 * Miles: A miles away from the location maximum (eg, within 30 miles). Default: 10
 * Event type: Rally, town hall, etc. The default is "event" which will return all events.
 */

function getDateFromSlots (slots,propName) {
	let retDate = undefined;
  if (slots[propName].hasOwnProperty('value')) {
  	if (!isNaN(Date.parse(slots[propName].value))) {
	  	retDate = new Date(slots[propName].value.replace(/-/g, '\/'));
 	  	console.log(propName + ":" + retDate.toDateString() + " from " + slots[propName].value);
	  }
  }
  return retDate;
}

function getBeforeAfterOn (slots) {
	let bao = "";
	if (slots.beforeAfterOn.hasOwnProperty('value')) {
		let txt = slots.beforeAfterOn.value.toLowerCase();
		if (txt == "before" || txt == "on" || txt == "after") {
			bao = txt;
		} else if (txt == "until") {
			bao = "before";
		} else if (txt == "on the day of") {
			bao = "on";
		}
	}
	return bao;
}

/**
 * Default is the nearest event, regardless of time
 */
function getNextOrNearest (slots) {
	let non = "nearest";
	if (slots.nextNearest.hasOwnProperty('value')) {
		let txt = slots.nextNearest.value.toLowerCase();
		if (txt == "next" || txt == "nearest" || txt == "nearby") {
			non = txt;
		} else if (txt == "closest") {
			non = "nearest";
		} else if (txt == "upcoming") {
			non = "next";
		}
	}
	return non;
}

/*
 * Default miles is 10;
 */
function getMiles (slots) {
  let miles = 10;
  if (slots.miles.hasOwnProperty('value')) {
  	if (typeof slots.miles.value === 'number' ||
  	!isNaN(parseInt(slots.miles.value))) {
	  	miles = slots.miles.value;
 	  	console.log("miles: " + miles);
	  }
  }
	return miles;
}

function getEventType (slots) {
  //make event type upper case for easier comparison later
  let eventType = undefined;
  if (slots.eventType.hasOwnProperty('value')) {
		eventType = slots.eventType.value.toUpperCase();
		if (eventType == "TICKETED EVENT") {
			eventType = "TICKED EVENT"; //idiosyncracy of source data
		} else if (eventType == "TOWNHALL") {
			eventType = "TOWN HALL"; //sometimes Alexa hears this as one word
		}
		console.log("Event type: " + eventType);
  }
  return eventType;
}

/*
 * Checks if a single event passes the options filter
 */
function passesFilter(eventObj, lat, lng, miles, beforeAfterOn, eventDate, eventType) {
	var td = new Date();
	return ((miles === undefined || distance(lat,lng,eventObj.lat,eventObj.lng, 'M') <= miles) &&
				(!(isNaN(Date.parse(eventObj.Date)))) && (td < Date.parse(eventObj.Date)) &&
      	(eventDate === undefined || beforeAfterOn != "before" || (eventObj.Date != undefined && eventDate.valueOf() > Date.parse(eventObj.Date))) &&
      	(eventDate === undefined || beforeAfterOn != "after" || (eventObj.Date != undefined && eventDate.valueOf() < Date.parse(eventObj.Date))) &&
      	(eventDate === undefined || beforeAfterOn != "on" || (eventObj.Date != undefined && eventDate.valueOf() == Date.parse(eventObj.Date))) &&
      	(eventType === undefined || eventType == "EVENT" ||
      		(eventObj.Date != undefined && eventObj.meetingType.toUpperCase() == eventType)));
}

/*
 * Return the nearest event (or next event given options)
 * Inputs are a latitude/longitude as center point.
 * Slots contains the options.
 * Returns one event or null if no event matches criteria
 */

function returnNearest (lat,lng, slots) {
 
	let miles = getMiles(slots);

  let beforeAfterOn = getBeforeAfterOn(slots);
  let eventDate = getDateFromSlots(slots,"eventDate");
  
	let eventType = getEventType(slots);
	
	let nextOrNearest = getNextOrNearest(slots);

  var locations = [];
  return firebase.database().ref('/townHalls/').once('value')
  .then(function(townHallsSS) {
    townHallsSS.forEach(function(ele){
      if (ele.val().StateAb !== 'DC' && //DC criterion is in original resistancenearme.org code
      	passesFilter(ele.val(), lat, lng, miles, beforeAfterOn, eventDate, eventType)) {
        locations.push(ele.val());
      }
    });
  })
  .then(function(){
    return firebase.database().ref('/capEvents/').once('value')
    .then(function(capSS) {
      capSS.forEach(function(ele){
        //capEvent.removeUnaffliated();
        if (passesFilter(ele.val(), lat, lng, miles, beforeAfterOn, eventDate, eventType)) {
	        locations.push(ele.val());
	      }
      });
      if (locations.length == 0) return null;
      var sorted = null;
      if (nextOrNearest == "next") { //if user wants next even chronologically
	    	var td = new Date();
	    	console.log("sorting next with td as " + td);
		    sorted = locations.sort(function (a , b) {
		    	//compare two dates
		    	var ad = Date.parse(a.Date);
		    	var bd = Date.parse(b.Date);
		    	if (isNaN(ad) && isNaN(bd)) {
		    		return 0;
		    	} else if (isNaN(ad)) {
		    		return 1;
		    	} else if (isNaN(bd)) {
		    		return -1;
		    	} else {
		    		return ad - bd;
		    	}
			  });
      } else { //default to nearest
		    sorted = locations.sort(function (a , b) {
		      a.dist = distance(lat,lng,a.lat,a.lng);
		      b.dist = distance(lat,lng,b.lat,b.lng);
		      return a.dist <= b.dist ? -1 : 1;
			  });
      }
	    console.log(sorted[0]);
	    return sorted[0];
    });
  });
}

/*
 * Takes the default date string format from resistancenearme ("Sat Apr 04 ...")
 * and converts to something Alexa will read intelligently ("Saturday April 4")
 */
function convertMonthAndDayOfWeek(dateStr) {
	var monthNames = ["January", "February", "March","April", "May", "June", "July",
    "August", "September", "October","November", "December"];
	var monthAbbrs = ["Jan", "Feb", "Mar","Apr", "May", "Jun", "Jul",
    "Aug", "Sep", "Oct","Nov", "Dec"];
  var dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var dayAbbrs = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (var i = 0; i < monthNames.length; i++) {
  	dateStr = dateStr.replace(monthAbbrs[i], monthNames[i]);
  	if (i<7) {
	  	dateStr = dateStr.replace(dayAbbrs[i], dayNames[i]);
  	}
	}
	dateStr = dateStr.replace(" 0"," ");
	return dateStr;
}

/*
 * Given a message object to provide to user as Alexa's answer,
 * return a sensible string that details event's core attributes:
 * name, location, date, time.
 */

function getEventMessage(eventObj, slots) {
	let eventName = eventObj.eventName;
	
	let eventType = "event";
	if (slots.eventType.hasOwnProperty('value')) {
		eventType = slots.eventType.value;
	}
	
	if (eventName== "" || eventName===undefined) {
		eventName = eventObj.meetingType;
		if (eventName== "" || eventName===undefined) {
			eventName="unnamed event";
		}
	}
	
	let eventLocation = eventObj.City;
	let addState = true;
	if (eventLocation=="" || eventLocation===undefined) {
		eventLocation = eventObj.address;
		if (eventLocation === undefined || eventLocation == "") {
			eventLocation=" in unknown city";
		} else {
			eventLocation = " at " + eventLocation;
			addState = false;
		}
	} else {
		eventLocation = " in " + eventLocation;
	}
	
	let eventState = eventObj.State;
	if (addState && !(eventState== "" || eventState===undefined)) {
		eventLocation += ", " + eventState;
	}
	
	let eventDateTime = eventObj.Date;
	if (eventDateTime== "" || eventDateTime===undefined) {
		eventDateTime = "unknown date";
	}	else {
		eventDateTime = convertMonthAndDayOfWeek(eventDateTime);
	}
	
	let eventTime = eventObj.Time;
	if (eventTime == "" || eventTime===undefined) {
		eventTime = "unknown time";
	}
	if (eventDateTime != "unknown time") {
		eventDateTime += " at " + eventTime;
	}
	
	let nextOrNearest = getNextOrNearest(slots);
	
	var output = "The " + nextOrNearest + " " + eventType + " is " + eventName + eventLocation + " on " + eventDateTime;
	console.log(output);
	return(output);
}

/*
 * Add ordinal to date for better speaking
 * from http://stackoverflow.com/questions/15397372/javascript-new-date-ordinal-st-nd-rd-th
 */
function dateNth(d) {
  if(d>3 && d<21) return (d+'th'); // thanks kennebec
  switch (d % 10) {
        case 1:  return (d+"st");
        case 2:  return (d+"nd");
        case 3:  return (d+"rd");
        default: return (d+"th");
    }
} 

/*
 * Takes a date object and returns the voice-friendly month and day
 * Current only used for the "sorry no event found" message
 * TODO: Add to "event found" message
 */
function getDatesMonthDay (dt) {
	let monthNames = ["January", "February", "March", "April", "May", "June",
  	"July", "August", "September", "October", "November", "December"];
  if (!dt) {
  	return "";
  } else {
	  return monthNames[dt.getMonth()] + " " + dateNth(dt.getDate());
	}
}

/*
 * Generate the no event found message, customized to repeat back
 * the user's options. This is helpful in case Alexa misheard
 * an option. Return string.
 */
function getNoEventFoundMessage(slots) {
	
	let eventType = "events";
	if (slots.eventType.hasOwnProperty('value')) {
		eventType = slots.eventType.value + "s";
	}
	
	let geoString = "you";
	if (slots.zip.hasOwnProperty('value')) {
		geoString = "zip code " + slots.zip.value;
	} else if (slots.city.hasOwnProperty('value')) {
		geoString = slots.city.value;
	}
	
	let dateRangeString = "";
	var dt = getDateFromSlots(slots,"eventDate");
	if (dt) {
		dateRangeString = getBeforeAfterOn(slots) + " " + getDatesMonthDay(getDateFromSlots(slots,"eventDate"));
		}
	
	var output = "Sorry, I couldn't find any " + eventType + " near " + geoString + " " + dateRangeString;
	console.log(output);
	return(output);
}

/*
 * If user provides a city (and state) as center for lookup, this is entry function
 * Relies on google's geocoder
 */
function lookupCity (city, state, slots, callback) {
	try{
		geocoder.geocode(city + ", " + state).then(function(res) {
			returnNearest(res[0].latitude, res[0].longitude, slots).then(function(nearest) {
				if(nearest === null) {
					callback(getNoEventFoundMessage(slots));
				} else {
					callback(getEventMessage(nearest, slots));
				}
			});
		});
	} catch(error){
			console.log('AR error in lookupCity' + error.message);
			callback("Sorry, something went wrong when I tried to look up events for city " + city);
	}
}

/*
 * If user provides a zip as center for lookup, this is entry function
 * Relies on resistancenearme.org firebase db
 */
function lookupZip (zip, slots, callback) {
	if (zip === null || zip === undefined || isNaN(zip) || (typeof zip == "string" && zip.length != 5)) {
		callback("Sorry, that is an unrecognized zipcode");
	} else {
		try{
			firebasedb.ref('/zips/' + zip).once('value').then(function(snapshot) {
				if (snapshot.val() == null) {
					callback("Zip code " + zip + " not found");
				} else {
					returnNearest(snapshot.val().LAT, snapshot.val().LNG, slots).then(function(nearest) {
						if(nearest === null) {
							callback(getNoEventFoundMessage(slots));
						} else {
							callback(getEventMessage(nearest, slots));
						}
					});
				}
			});
		} catch(error){
				console.log('AR error in lookupZip' + error.message);
				callback("Sorry, something went wrong when I tried to look up events for zip code " + zip);
		}
	}
}

/*
 * If user provides "near me" (eg near Alexa device) as center point,
 *  this is entry function. Relies on Alexa's API to find zip code
 * User must enable this permission (proactively I believe) for this to work.
 */
function lookupNearMe (context, slots, callback) {
	try{
	  const deviceId = context.System.device.deviceId;
	  const consentToken = context.System.user.permissions.consentToken;
	  console.log(deviceId + "\n" + consentToken);
	  var request = require('request');
	  var options = {
  		url: "https://api.amazonalexa.com/v1/devices/" + deviceId + "/settings/address/countryAndPostalCode",
  		headers: {
    		'Authorization': 'Bearer ' + consentToken
  		}
		};
	  request(options, function (error, response, body) {
	  	if (error) {
		  	console.log('alexa api error:', error);
		  	callback("Alexa API error");
		  }
		  if (body) {
				console.log(body);
		  	let bodyJson = JSON.parse(body);
		  	//for local debugging
		  	if (!('undefined' === typeof process.env.DEBUG) && bodyJson.type == "FORBIDDEN") {
		  		bodyJson.postalCode = "22202";
		  	}
		  	console.log("Zip from Near Me:" + bodyJson.postalCode);
				lookupZip(bodyJson.postalCode, slots, callback);
		  }
	  });
	} catch(error){
			console.log('AR error in lookupNearMe' + error.message);
			callback("Sorry, something went wrong when trying to access your zip code. Make sure you have that permission enabled for this skill in Alexa app.");
	}
}


/**
 * Calc distance between two lat and long.
 * Unit defaults to miles
 * from http://www.geodatasource.com/developers/javascript
 */
function distance(lat1, lon1, lat2, lon2, unit) {
	var radlat1 = Math.PI * lat1/180
	var radlat2 = Math.PI * lat2/180
	var theta = lon1-lon2
	var radtheta = Math.PI * theta/180
	var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
	dist = Math.acos(dist)
	dist = dist * 180/Math.PI
	dist = dist * 60 * 1.1515
	if (unit=="K") { dist = dist * 1.609344 }
	if (unit=="N") { dist = dist * 0.8684 }
	return dist
}



/**
 * Entry to main worflow.
 * Determines if user has provided city/state, zip, or neither and proceeds from there
 */
function getEvent(intent, context, callback) {
  const slots = intent.slots;
  console.log(slots);
  if (slots.zip.hasOwnProperty('value')) {
  	let zip = slots.zip.value;
  	console.log("zip: " + zip);
  	lookupZip(zip, slots, callback);
  } else if (slots.city.hasOwnProperty('value')) {
  	let city = slots.city.value;
  	let state = "";
  	if (slots.state.hasOwnProperty('value')) {
  		state = slots.state.value;
  	}
  	console.log("city-state: " + city + ", " + state);
  	lookupCity(city, state, slots, callback);  	
  } else {
  	lookupNearMe(context, slots, callback);
  }
  	
	
}

/**
 * List of event types
 */
function listEventTypes(intent, callback) {
    callback("To hear all events just say event near me. You can also specify an event type. The choices are: Rally, Town Hall, Empty Chair Town Hall, DC Event, Office Hours, Ticketed Event, Tele-Town Hall, Coffee, and Other.");
}

