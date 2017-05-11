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
 * See how to handle states from this code: https://github.com/alexa/skill-sample-nodejs-highlowgame/blob/master/src/index.js
 */
var Alexa = require('alexa-sdk');
var genericPrompt = " Tell me about the event you'd like to find."
var quickGoodbye = "Goodbye!";
var longGoodbye = " Happy protesting! Goodbye.";
var helpResponse = "Try saying find the next event near me. Be sure to enable the location permission in your app.";
var Speech = require('ssml-builder');

var states = {
    FINDMODE: '_FINDMODE', // User is trying to find an event
    DETAILMODE: '_DETAILMODE'  // Prompt the user to get the details of this event or the next one in line
};
		
exports.handler = function(event, context, callback){
    var alexa = Alexa.handler(event, context);
    if ('undefined' === typeof process.env.DEBUG) {
  		alexa.appId = 'amzn1.ask.skill.d6116c8d-31f0-4cfb-aae6-6f3208bc450a';
		}
    //from https://www.npmjs.com/package/alexa-skill-test
    alexa.registerHandlers(newSessionHandlers, findModeHandlers, detailModeHandlers);
    alexa.execute();
};

/*
 * Handlers for the empty state. Used for launch
 */
var newSessionHandlers = {
    /*'NewSession': function() {
    		console.log("launch state NewSession");
        this.handler.state = states.FINDMODE;
        this.emit(':ask', "Welcome to Resist Events." + genericPrompt);
    },*/
    'LaunchRequest': function() {
    	console.log("launch state launch request");
    	this.handler.state = states.FINDMODE;
    	var needsPermissionsMsg = !hasConsentToken(this.event.context);
    	var msg =  "Welcome to Resist Events.";
    	if (needsPermissionsMsg) {
    		msg += " Turn on location permissions for easier use."
    	}
    	msg += genericPrompt;
			this.attributes['lastMsg'] = msg;
      this.emit(':ask',msg);
    },
    //If a user says "Alex, find the next event near me using Resist Events"
    //then the GetEvent handler will be triggered without a state
    //but we want to be in FINDMODE, so we set the state and transfer the event
    'GetEvent': function() {
        this.handler.state = states.FINDMODE;
        console.log("launch state GetEvent");
        this.emitWithState('GetEvent');
    },
    'AMAZON.HelpIntent': function () {
      console.log("launch state Help");
      this.handler.state = states.FINDMODE;
      var msg = helpResponse;
 			this.attributes['lastMsg'] = msg;
			this.emit(":ask",msg);
		},
		'MyHelpIntent': function () {
      console.log("launch mode My Help Intent");
      this.emit('AMAZON.HelpIntent');
		},
		'ListOptions': function () {
			console.log("launch mode list options");
    	this.handler.state = states.FINDMODE;
    	this.emitWithState('ListOptions');
    },
		'ListSource': function () {
			console.log("launch mode list source");
    	this.handler.state = states.FINDMODE;
    	this.emitWithState('ListSource');
    },
		'ListEventTypes': function () {
			console.log("launch mode ListEventTypes");
    	this.handler.state = states.FINDMODE;
    	this.emitWithState('ListEventTypes');
    },
		'EventAddress': function () {
			console.log("launch mode EventAddress");
			if (this.attributes && this.attributes['thisEvent']) {
				this.handler.state = states.DETAILMODE;
	      this.emitWithState('EventAddress');
			} else {
				this.handler.state = states.FINDMODE;
				var msg = helpResponse;
				this.attributes['lastMsg'] = msg;
	      this.emit(":ask",msg);
	    }
    },
    'RepeatLast': function () {
			console.log("launch mode RepeatLast");
			if (this.attributes && this.attributes['lastMsg']) {
				this.emit(":ask",this.attributes['lastMsg'])
			} else {
	      this.emit('LaunchRequest');
	    }
    },
		'AnotherSearch': function () {
			console.log("launch mode AnotherSearch");
			var msg = genericPrompt;
			this.handler.state = states.FINDMODE;
			this.attributes['lastMsg'] = msg;
      this.emit(":ask",msg);
    },
    //assume that this is a GetEvent request in disguise
    //find mode handler has the proper logic
		'NextEvent': function () {
			console.log("launch mode NextAddress");
			this.handler.state = states.FINDMODE;
      this.emitWithState('NextAddress');
    },
		'Unhandled': function () {
      console.log("launch state Unhandled");
      var msg = "Sorry, I didn't understand that request. Try simplifying or looking at example requests. Also, sometimes I get confused with dates. Try May twenty two instead of May twenty second.";
			this.attributes['lastMsg'] = msg;
			this.emit(":ask",msg);
    },
    'AMAZON.StopIntent': function() {
      console.log("launch state Stop");
      this.emit(':tell', quickGoodbye);  
    },
    'AMAZON.CancelIntent': function() {
      console.log("launch state Cancel");
      this.emit(':tell', quickGoodbye);  
    },
		'QuitEvent': function () {
      console.log("launch state Quit");
      this.emit('AMAZON.StopIntent');  
    },
    'SessionEndedRequest': function () {
      console.log("Launch state Session ended");
      this.emit('AMAZON.StopIntent');
    }
};

/*
 * Handlers for the state where we are expecting to find the next event
 */
var findModeHandlers = Alexa.CreateStateHandler(states.FINDMODE, {
    /*
     * Need to comment this out because otherwise the debugging package does not work
     * Having a new session is in Amazon's sample code (for number guesser) so I'm
     * not sure if this will break things. Hopefully not -- new sessions should only be called
     * with blank states, right?
     *
     *'NewSession': function () {
    		console.log("findmode NewSession");
        this.handler.state = '';
        this.emitWithState('NewSession'); // Equivalent to the Start Mode NewSession handler
		},*/
    'LaunchRequest': function() {
    	console.log("find mode launchrequest");
    	this.emit('LaunchRequest'); //send upstream
    },
    'GetEvent': function () {
      console.log("find mode GetEvent");
    	var alex = this;
    	getEvent(alex.event.request.intent, alex.event.context, function(nearest) {
    			var slots = alex.event.request.intent.slots;
    			alex.attributes['querySlots'] = slots;
    			var msg = "";
		  		if (typeof nearest === 'string') { //if it's a string, that means it was an error
		  			msg = nearest + " You can try again or say quit to end.";
		  			console.log(msg);
		  		} else if (nearest === null || nearest.length == 0) {
		  			alex.handler.state = states.FINDMODE;
						msg = getNoEventFoundMessage(slots) + " You can try again or say quit to end.";
					} else {
						alex.handler.state = states.DETAILMODE;
						alex.attributes['thisEvent'] = nearest[0];
						if (nearest.length > 1) {
							alex.attributes['restEvents'] = nearest.slice(1,nearest.length);
							msg = craftEventMessage(nearest[0], slots, false, true);
						} else {
							alex.attributes['restEvents'] = null;
							msg = craftEventMessage(nearest[0], slots, false, false);
						}
					}
					alex.attributes['lastMsg'] = msg;
	        alex.emit(':ask', getSSML(msg));
        })
    },
    'ListEventTypes': function () {
      console.log("find mode List Events");
      var msg = "To hear all events just say event near me. You can also specify an event type. The choices are: Rally; Town Hall; Office Hours; Ticketed Event; Empty Chair Town Hall; Coffee; and Tele-Town Hall." + " " + genericPrompt;
 			this.attributes['lastMsg'] = msg;
	    this.emit(':ask',msg);
    },
		'ListOptions': function () {
      console.log("find mode List Options");
			var msg = "You can specify before, after or on a specific date.  Within a certain mile radius.  Search by zip code or by city and state.  You can also narrow by event type."  + genericPrompt;
			this.attributes['lastMsg'] = msg;
			this.emit(":ask",msg);
    },
		'ListSource': function () {
      console.log("find mode List Source");
			var msg = "Events are provided by resistance near me dot org. This Alexa skill is not affiliated with them."  + genericPrompt;
			this.attributes['lastMsg'] = msg;
			this.emit(":ask",msg);
    },
    'RepeatLast': function () {
      console.log("find mode Repeat Last");
			if (this.attributes['lastMsg'] && this.attributes['lastMsg'].length > 0) {
				this.emit(':ask',this.attributes['lastMsg']);
			} else {
		    this.handler.state = '';
				this.emitWithState('LaunchRequest');
			}
		},
		//if this is being called here, I assume that the user meant GetEvent
		'NextEvent': function () {
      console.log("find mode NextEvent -> GetEvent");
      var slots = this.event.request.intent.slots;
      slots = addBasicGetEventSlots(slots);
			this.emitWithState('GetEvent');
		},
    //these next two should not be triggered in this state
    //pass to launch state which has the proper logic
		'EventAddress': function () {
      console.log("find mode Event Address");
      this.handler.state = '';
			this.emitWithState('EventAddress');
		},
		'AnotherSearch': function () {
      console.log("find mode Another Search");
      this.handler.state = '';
			this.emitWithState('AnotherSearch');
		},
    'Unhandled': function () {
      console.log("find mode Unhandled");
      var msg = "Sorry, I didn't understand that request. Try simplifying or looking at example requests. Also, sometimes I get confused with dates. Try May twenty two instead of May twenty second.";
			this.attributes['lastMsg'] = msg;
			this.emit(":ask",msg);
    },
		'MyHelpIntent': function () {
      console.log("find mode My Help Intent");
      this.emitWithState('AMAZON.HelpIntent');
		},
    'AMAZON.HelpIntent': function () {
      console.log("find mode Help");
      var msg = helpResponse;
			this.attributes['lastMsg'] = msg;
			this.emit(":ask",msg);
		},
		'QuitEvent': function () {
      console.log("find mode Quit");
			this.emitWithState('AMAZON.StopIntent');
		},
		'AMAZON.StopIntent': function() {
      console.log("find mode Stop");
			this.emit(':tell', quickGoodbye);
		},
		'AMAZON.CancelIntent': function() {
      console.log("find mode Cancel");
      this.emit(':tell', quickGoodbye);
    },
    'SessionEndedRequest': function () {
	    console.log("find mode Session Ended");
      this.emitWithState('AMAZON.StopIntent');
		}
});

/*
 * Handlers for the state where we are giving details of found events
 * and/or looping through events
 * Whevener the state is DETAILMODE, the attribute 'thisEvent' should be set
 * ...if thisEvent is null, we go back to the beginning
 */
var detailModeHandlers = Alexa.CreateStateHandler(states.DETAILMODE, {
    /*'NewSession': function () {
        this.handler.state = '';
        this.emitWithState('NewSession'); // Equivalent to the Start Mode NewSession handler
		},*/
    'LaunchRequest': function() {
    	console.log("detail mode launchrequest");
    	this.emit('LaunchRequest'); //send upstream
    },
		//Provide the user with the exact address of the current event
		'EventAddress': function () {
      console.log("detail mode Event Address");
			var curEvent = this.attributes['thisEvent'];
			if (curEvent == null) {
				//this should never happen
        this.handler.state = '';
        this.emitWithState('LaunchRequest');
			} else {
				var msg = '';
				if (curEvent.hasOwnProperty('address') && curEvent.address != null && curEvent.address != '') {
					msg = "Address is " + curEvent.address + ".";
				} else {
					msg = "Sorry, no address provided.";
				}
				if (this.attributes['restEvents']==null) {
					msg += " Would you like the a new search or quit?";
				} else {
					msg += " Would you like the next event, a new search, or quit?";
				}
				this.attributes['lastMsg'] = msg;				
				this.emit(':ask', getSSML(msg));
			}
		},
		'NextEvent': function () {
      console.log("detail mode Next Event");
			var nearest = this.attributes['restEvents'];
			var slots = this.attributes['querySlots'];
			if (nearest == null || nearest.length == 0) {
				this.emit(':ask',"Sorry, no more events. Would you like a new search or to quit?");
			} else {
				var msg = "";
				this.attributes['thisEvent'] = nearest[0];
				if (nearest.length > 1) {
					this.attributes['restEvents'] = nearest.slice(1,nearest.length);
					msg = craftEventMessage(nearest[0], slots, true, true);
				} else {
					this.attributes['restEvents'] = null;
					msg = craftEventMessage(nearest[0], slots, true, false);
				}
				this.attributes['lastMsg'] = msg;
				this.emit(':ask', getSSML(msg));
			}
		},
		'RepeatLast': function () {
      console.log("detail mode Repeat Last");
			if (this.attributes['lastMsg'] && this.attributes['lastMsg'].length > 0) {
				this.emit(':ask',this.attributes['lastMsg']);
			} else {
		    this.handler.state = '';
				this.emitWithState('LaunchRequest');
			}
		},
		//So, technically, this shouldn't be called here, BUT
		//it's easy for the user/Amazon to get confused between "next event [near me]"
		//and "next event [in the list]
		//So if I think the user is asking for the next event, pass that info on
		'GetEvent': function () {
      console.log("detail mode Get Event");
			var slots = this.event.request.intent.slots;
			if (getNextOrNearest(slots) == "next" && getBeforeAfterOn(slots) == "" &&
					!(slots.city && slots.city.hasOwnProperty('value')) && 
					!(slots.zip && slots.zip.hasOwnProperty('value'))) {
				this.emitWithState('NextEvent');
			} else {
				//otherwise, I'm not sure what's going on -- why is a user asking for an event search
				//might as well try to execute their search.
		    this.handler.state = states.FINDMODE;
				this.emitWithState('GetEvent');
			}
		},
		'AnotherSearch': function () {
      console.log("detail mode Another Search");
      this.handler.state = '';
			this.emitWithState('AnotherSearch');
		},
		'ListOptions': function () {
			console.log("detail mode list options");
    	this.emitWithState('AMAZON.HelpIntent');
    },
		'ListSource': function () {
			console.log("detail mode list source");
    	this.handler.state = states.FINDMODE;
    	this.emitWithState('ListSource');
    },
		'ListEventTypes': function () {
			console.log("detail mode ListEventTypes");
    	this.handler.state = states.FINDMODE;
    	this.emitWithState('ListEventTypes');
    },
		'Unhandled': function () {
      console.log("detail mode Unhandled");
			this.emit(":ask","Sorry, I didn't understand that request. Try saying exact address or next event or new search.");
    },
		'MyHelpIntent': function () {
      console.log("detail mode My Help Intent");
      this.emitWithState('AMAZON.HelpIntent');
		},    
		'AMAZON.HelpIntent': function () {
      console.log("detail mode Help Intent");
			this.emit(':ask',"Try saying address, next, new search, or quit");
		},
		'QuitEvent': function () {
      console.log("detail mode Quit");
			this.emit(':tell',longGoodbye);
		},
		'AMAZON.StopIntent': function() {
      console.log("detail mode Stop");
			this.emit(':tell',quickGoodbye);
		},
		'AMAZON.CancelIntent': function() {
      console.log("detail mode Cancel");
      this.emitWithState('AMAZON.StopIntent');
    },
    'SessionEndedRequest': function () {
      console.log("detail mode Session Ended");
       this.emitWithState('QuitEvent');
		}
});

function hasConsentToken(context) {
	return (context.System.user.permissions && context.System.user.permissions.consentToken && context.System.user.permissions.consentToken.length > 0);
}

function getSSML(msg) {
	var speech = new Speech();
	speech.say(msg);
	return speech.ssml(true);
}

/* 
 * Craft the main response after an event has been found
 * addNextLanguage is for adding "next" to "next nearest" in detail/loop mode
 * isRest is whether there are more events to be heard
 */

function craftEventMessage(curEvent, slots, addNextLanguage, isRest) {
	var msg = getEventMessage(curEvent, slots, addNextLanguage);
	var addAddress=false;
	if (curEvent.address && curEvent.address.length > 5 &&
			 curEvent.address.substring(0,4).toUpperCase() != "NONE") {
		addAddress = (msg.search(curEvent.address) == -1);
	}
	if (addAddress && isRest) {
		msg += " Would you like the exact address or hear about the next event?";
	} else if (addAddress && !isRest) {
		msg += " Would you like the exact address or try another search?";
	} else if (!addAddress && isRest) {
		msg += " Would you like to hear next event or try another search?";
	} else {
		msg += " Would you like to try another search or quit?";
	}
	return msg;
}

/*
 * If Amazon misinterpets the GetEvent request from the user and triggers
 * another intent, then I need to create basic slots for the GetEvent trigger
 * This technically shouldn't be necessary if I've written rigorous defensive code,
 * but better safe than sorry
 */
function addBasicGetEventSlots(slots) {
	slots['nextNearest'] = JSON.parse('{"name": "nextNearest", "value":"next"}');
	slots['zip'] = JSON.parse('{"name": "zip"}');
	slots['city'] = JSON.parse('{"name": "city"}');
	return slots;
}

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
 * Miles: A miles away from the location maximum (eg, within 30 miles). Default: 20
 * Event type: Rally, town hall, etc. The default is "event" which will return all events.
 */

function getDateFromSlots (slots,propName) {
	let retDate = undefined;
  if (slots[propName] && slots[propName].hasOwnProperty('value')) {
  	if (!isNaN(Date.parse(slots[propName].value))) {
	  	retDate = new Date(slots[propName].value.replace(/-/g, '\/'));
 	  	console.log(propName + ":" + retDate.toDateString() + " from " + slots[propName].value);
	  }
  }
  return retDate;
}

function getBeforeAfterOn (slots) {
	let bao = "";
	if (slots.beforeAfterOn && slots.beforeAfterOn.hasOwnProperty('value')) {
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
 * Default is the next event chronologically, as long as it meets geo constraints
 */
function getNextOrNearest (slots) {
	let non = "next";
	if (slots && slots.nextNearest && slots.nextNearest.hasOwnProperty('value')) {
		let txt = slots.nextNearest.value.toLowerCase();
		if (txt == "next" || txt == "nearest") {
			non = txt;
		} else if (txt == "closest" || txt == "nearby") {
			non = "nearest";
		} else if (txt == "upcoming") {
			non = "next";
		}
	}
	return non;
}

/*
 * Default miles is 20;
 */
function getMiles (slots) {
  let miles = 20;
  if (slots.miles && slots.miles.hasOwnProperty('value')) {
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
  if (slots.eventType && slots.eventType.hasOwnProperty('value')) {
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
	    console.log("Found " + sorted.length + " events");
	    //return first five events
	    return sorted.slice(0,5);
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
 * addNext is an optional parameter that adds a "next" for secondary events
 *   so that Alexa says "the next nearest"
 */

function getEventMessage(eventObj, slots, addNext) {
	let eventName = eventObj.eventName;
	
	let eventType = "event";
	if (slots && slots.eventType && slots.eventType.hasOwnProperty('value')) {
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
		eventLocation = eventObj.Location;
		if (eventLocation === undefined || eventLocation == "") {
			eventLocation = eventObj.address;
		}
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
	if (addNext && nextOrNearest == "nearest") {
		nextOrNearest = "next nearest";
	}
	
	var output = "The " + nextOrNearest + " " + eventType + " is " + eventName + eventLocation + " on " + eventDateTime + ".";
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
	if (slots.eventType && slots.eventType.hasOwnProperty('value')) {
		eventType = slots.eventType.value + "s";
	}
	
	let geoString = "you";
	if (slots.zip && slots.zip.hasOwnProperty('value')) {
		geoString = "zip code " + slots.zip.value;
	} else if (slots.city && slots.city.hasOwnProperty('value')) {
		geoString = slots.city.value;
	}
	
	let addmileage = !(slots.miles && slots.miles.hasOwnProperty('value'));
	
	let dateRangeString = "";
	var dt = getDateFromSlots(slots,"eventDate");
	if (dt) {
		dateRangeString = getBeforeAfterOn(slots) + " " + getDatesMonthDay(getDateFromSlots(slots,"eventDate"));
		}
	
	var output = "Sorry, I couldn't find any " + eventType + " near " + geoString + " " + dateRangeString + ".";
	if (addmileage) {
		output += ' Try adding "within 100 miles of".';
	}
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
			if (res[0]) {
				returnNearest(res[0].latitude, res[0].longitude, slots).then(function(nearest) {
					callback(nearest);
				});
			} else {
				callback("Sorry, I couldn't locate " + city + " on the map.");
			}
		});
	} catch(error){
			console.log('AR error in lookupCity' + error.message);
			callback("Sorry, something went wrong when I tried to look up events for city " + city + ".");
	}
}

/*
 * If user provides a zip as center for lookup, this is entry function
 * Relies on resistancenearme.org firebase db
 */
function lookupZip (zip, slots, callback) {
	if (zip === null || zip === undefined || isNaN(zip) || (typeof zip == "string" && zip.length != 5)) {
		callback("Sorry, that is an unrecognized zipcode.");
	} else {
		try{
			firebasedb.ref('/zips/' + zip).once('value').then(function(snapshot) {
				if (snapshot.val() == null) {
					callback("Zip code " + zip + " not found" + ".");
				} else {
					returnNearest(snapshot.val().LAT, snapshot.val().LNG, slots).then(function(nearest) {
						callback(nearest);
					});
				}
			});
		} catch(error){
				console.log('AR error in lookupZip' + error.message);
				callback("Sorry, something went wrong when I tried to look up events for zip code " + zip + ".");
		}
	}
}

/*
 * If user provides "near me" (eg near Alexa device) as center point,
 *  this is entry function. Relies on Alexa's API to find zip code
 * User must enable this permission (proactively I believe) for this to work.
 */
function lookupNearMe (context, slots, callback) {
	var permissionsCheckMsg = "Sorry, something went wrong when trying to access your zip code. Make sure you have that permission enabled for this skill in Alexa app.";
	if (!hasConsentToken(context)) {
		callback(permissionsCheckMsg);
	} else {
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
					
					if (!bodyJson.postalCode) {
						callback(permissionsCheckMsg);
					} else {
						console.log("Zip from Near Me:" + bodyJson.postalCode);
						lookupZip(bodyJson.postalCode, slots, callback);
					}
				}
			});
		} catch(error){
				console.log('AR error in lookupNearMe ' + error.message);
				callback(permissionsCheckMsg);
		}
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
  if (slots.zip && slots.zip.hasOwnProperty('value')) {
  	let zip = slots.zip.value;
  	console.log("zip: " + zip);
  	lookupZip(zip, slots, callback);
  } else if (slots.city && slots.city.hasOwnProperty('value') && slots.city.value.length > 0) {
  	let city = slots.city.value;
  	let state = "";
  	if (slots.state && slots.state.hasOwnProperty('value')) {
  		state = slots.state.value;
  	}
  	console.log("city-state: " + city + ", " + state);
  	lookupCity(city, state, slots, callback);  	
  } else {
  	lookupNearMe(context, slots, callback);
  }
	
}

