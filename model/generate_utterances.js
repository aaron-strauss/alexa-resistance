'use strict';

/* This was the original set but Amazon has an unfortunate UI character limit, so
 I'm limited to about 2500 utterances */
/*
var verbs = ["","get", "find", "locate", "tell"];
var verbDirectObjs = ["me","for me"];
var questionStarts = ["what is","where is"];
var articles = ["a","the","an"];
var nextNearest = [""," {nextNearest}"];
var middleConnectors = [""," resist"," resistance"];
var eventType = [" {eventType}"];
var distances = [""," within {miles} miles of"," to"," close to"," near"];
var locations = [""," me"," here"," {zip}"," {city} {state}"];
var dates = ["", " {beforeAfterOn} {eventDate}"];

var invalidStrings = ["an resist", "an resistance", "locate me"];
*/

var verbs = ["","get", "find", "tell"];
var verbDirectObjs = ["me"];
var questionStarts = ["what is"];
var articles = ["the"];
var nextNearest = [""," {nextNearest}"];
var middleConnectors = [""," resistance"];
var eventType = [" {eventType}"];
var distances = [""," within {miles} miles of"," to"," close to"," near"];
var locations = [""," me"," here"," {zip}"," {city} {state}"];
var dates = ["", " {beforeAfterOn} {eventDate}"];

var invalidStrings = ["an resist", "an resistance", "locate me"];

var verbStarts = [];
for(var i = 0; i < verbs.length; i++) {
	verbStarts.push(verbs[i]);
	if (verbs[i] != "") {
		for(var j = 0; j < verbDirectObjs.length; j++) {
			verbStarts.push(verbs[i] + " " + verbDirectObjs[j]);
		}
	}
}

var prefixes = verbStarts;
for(var i = 0; i < questionStarts.length; i++) {
	prefixes.push(questionStarts[i]);
}

var fullStarts = prefixes.slice(0);
for(var i = 0; i < prefixes.length; i++) {
	for(var j = 0; j < articles.length; j++) {
		fullStarts.push(prefixes[i] + " " + articles[j]);
	}
}

for(var i = 0; i < fullStarts.length; i++) {
	fullStarts[i] = fullStarts[i].trim();
}

//console.log(fullStarts);


var getEventUtterances = [];
for(var i = 0; i < fullStarts.length; i++) {
	for(var j = 0; j < nextNearest.length; j++) {
		for(var k = 0; k < middleConnectors.length; k++) {
			for(var m = 0; m < eventType.length; m++) {
				for(var n = 0; n < distances.length; n++) {
					for(var p = 0; p < locations.length; p++) {
						for(var q = 0; q < dates.length; q++) {
							var entry = fullStarts[i] + nextNearest[j] + middleConnectors[k] + eventType[m];
							if ((distances[n] != "" && locations[p] != "") || (distances[n]=="" && locations[p]==""))  {
								entry += distances[n] + locations[p];
							}
							entry += dates[q];
							entry = entry.trim();
							for(var r = 1; r < invalidStrings.length; r++) {
								if (entry.search(invalidStrings[r]) != -1) {
									entry = "";
								}
							}
							if (nextNearest[j] == "" && distances[n] == " to") {
								entry = "";
							}
							if (entry != "" && getEventUtterances.indexOf(entry) == -1) {
								getEventUtterances.push(entry);
							}
						}
					}
				}
			}
		}
	}
}
for(var i = 0; i < getEventUtterances.length; i++) {
	getEventUtterances[i] = "GetEvent " + getEventUtterances[i];
}


var fs = require('fs');

var allUtterances = getEventUtterances;
var secondaryUtterances = fs.readFileSync('secondary_intent_utterances.txt').toString().split("\n");
secondaryUtterances.forEach(function(item) {allUtterances.push(item);});


var file = fs.createWriteStream('sample_utterances.txt');
file.on('error', function(err) {return console.log(err);});
allUtterances.forEach(function(v) { file.write(v + '\n'); });
file.end();
console.log(allUtterances.length);
console.log("Done");


