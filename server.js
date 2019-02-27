const express = require("express");
const session = require("express-session");
const path = require("path");
const timediff = require("timediff");
const axios = require('axios');
const Discord = require("discord.js");
const client = new Discord.Client();
const mongoose = require("mongoose");
const esi = require("eve-swagger");
const passport = require("passport");
const EveOAuth2Strategy = require("passport-eve-oauth2").Strategy;
const User = require("./app/models/user");
const Fleet = require("./app/models/fleet");
const data = require("./config.json");

mongoose.connect(data.dbURL, { useNewUrlParser: true }); 
mongoose.set("debug",true);

let esi2 = esi({
	service: "https://esi.evetech.net",
	source: "tranquility",
	agent: "eve-swagger | https://github.com/lhkbob/eve-swagger-js",
	language: "en-us",
	timeout: 6000,
	minTime: 0,
	maxConcurrent: 0
});

passport.use(new EveOAuth2Strategy({
	clientID: data.clientID,
	clientSecret: data.clientSecret,
	callbackURL: "http://149.56.225.38:5000/auth/eve/callback",
	state: "3jINrw1CA$*55EEAsO",
	scope: "esi-location.read_location.v1 esi-fleets.read_fleet.v1"
},
function(accessToken, refreshToken, profile, done) {
	User.findOne({ 'CharacterID': profile.CharacterID }, function(err, user) {
		if (err) {
			return done(err);
		}
		if (!user) {
			user = new User({
				CharacterID: profile.CharacterID,
				CharacterName: profile.CharacterName,
				DiscordID: "",
				ExpiresOn: profile.ExpiresOn,
				accessToken: accessToken,
				refreshToken: refreshToken
			});
			user.save(function(err) {
				if (err) console.log(err);
				return done(err, user);
			});
		} else {
			return done(err, user);
		}
	});
}));

passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});

var app = express();
app.use("/static", express.static(path.join(__dirname, "static")));
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(session({ 
	secret: 'pZ0pzow@DOO4XY@LSi',
	resave: false,
	saveUninitialized: false
})); 
app.use(passport.initialize());
app.use(passport.session()); 

 currentTime = new Date().toLocaleTimeString();
var startTimeISO = new Date().toISOString();

app.get("/auth/eve",
	passport.authenticate("eveOnline")
);
 
app.get("/auth/eve/callback", 
	passport.authenticate("eveOnline", { 
		successRedirect : '/success',
		failureRedirect : '/'
	}));

app.get("/", (req, res) => {
	res.status(200).sendFile(path.join(__dirname, "index.html"));
});

app.get('/success', isLoggedIn, function(req, res) {
	res.render('success.ejs');
});

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();
    res.redirect('/');
}

async function refreshToken(refreshToken,ID){
	var refreshToken = refreshToken;
	var options = {
		method: 'post',
		data: {
		  'grant_type':"refresh_token",
		  'refresh_token':refreshToken
		},
		json: true, 
		timeout: 10000, 
		url: 'https://login.eveonline.com/v2/oauth/token',
		headers: {
			"Authorization": "Basic ZTQ4MTQ3NjU2OTY0NDhhNjgwNmEwNWU0ZjZiYTU3OGQ6ZEtyNG9rOEpRbHVkTE9xOWNSZWZzdHdLNHFtMFl3ZmhWbFprcFR5UQ==",
			"Accept": "application/json",
			"Content-Type": "application/json",
			"Cache-Control": "no-cache"
		}
	}
	
	axios(options)
	.then(function (response) {
		console.log(response.data);
		var newExpireDate = (new Date).getTime() + response.data.expires_in;
		User.findOne({  'DiscordID' : ID },function(err, doc) {
			User.findOneAndUpdate(doc._id, {$set: { accessToken: response.data.access_token, refreshToken: response.data.refresh_token, ExpiresOn: newExpireDate }}, {'new': true}, function (err, result) {
				if (err) { client.users.get(disccordID).send('There was a problem refreshing your access token!') }
			});
		});
	})
	.catch(function (error) {
		console.log(error);
		client.users.get(disccordID).send('There was a problem refreshing your access token!')
	});	

	return;
};

function linkAccounts(ID,charName) {
	var disccordID = ID;
	var eveCharName = charName;
	User.findOne({  'CharacterName' : charName },function(err, doc) {
		User.findOneAndUpdate(doc._id, {$set: { DiscordID: disccordID }}, {'new': true}, function (err, result) {
			if (err) { client.users.get(disccordID).send('There was a problem adding the information to the database.') }
		});
	});
	client.users.get(disccordID).send("Thank you for linking your EVE and Discord accounts! From here all parts of the bot will work for you!")
}

function registerFleet(ID,fleetID,fleetName) {
	User.findOne({  'DiscordID' : ID },function(err, doc) {
		if ( doc.ExpiresOn <= Date.now() ) {
			refreshToken(doc.refreshToken,ID);
			User.findOne({  'DiscordID' : ID },function(err, doc) {
				esi2.characters(doc.CharacterID, doc.accessToken).fleet(fleetID).info().then(result => {
					console.error(fleetName + " : " + result);
					Fleet.findOne({ 'fleet_name' : fleetName }, function(err, fleet) {
						if (!fleet) {
							fleet = new Fleet({
								fleet_name: fleetName,
								is_free_move: result.is_free_move,
								is_registered: result.is_registered,
								is_voice_enabled: result.is_voice_enabled,
								motd: result.motd
							});
							fleet.save(function(err) {
								if (err) console.log(err);
							});
						}
					});
				}).catch(error => {
					console.error(error);
				});
			});
		} else {
			esi2.characters(doc.CharacterID, doc.accessToken).fleet(fleetID).info().then(result => {
				console.error(fleetName + " : " + result);
				Fleet.findOne({ 'fleet_name' : fleetName }, function(err, fleet) {
					if (!fleet) {
						fleet = new Fleet({
							fleet_name: fleetName,
							is_free_move: result.is_free_move,
							is_registered: result.is_registered,
							is_voice_enabled: result.is_voice_enabled,
							motd: result.motd
						});
						fleet.save(function(err) {
							if (err) console.log(err);
						});
					}
				});
			}).catch(error => {
				console.error(error);
			});

		}
	});
}

function fleet() {
	
}

client.on("ready", () => {
	console.log(`[ BOT ] : ${currentTime} : Logged in as ${client.user.tag}, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds!`);
	console.log(`------`);

	function tranquilityStatus() {
		esi2.status().then(result => {
			if (result.players > 0) {
				let currentTime = new Date().toLocaleTimeString();
				//console.log(`### Tranquility Server Status @ ${currentTime} ###`);
				//console.log(`   Players: ${result.players} - Server Version: ${result.server_version} - Server Start Time: ${result.start_time}`);
				client.user.setPresence({ game: { name: "Tranquility | ONLINE", type: 0 } });
				setTimeout(function(){
					client.user.setPresence({ game: { name: `Tranquility | Pilots ${result.players}`, type: 0 } });
				}, 5000);
				setTimeout(function(){
					var n = new Date().toISOString();
					var uptime = timediff(result.start_time, n, "H")
					client.user.setPresence({ game: { name: `Tranquility | Uptime ${uptime.hours}h`, type: 0 } });
				}, 10000);
			} else {
				console.log(`### Singularity Server Error ###`);
				console.log(result);
				client.user.setPresence({ game: { name: "Tranquility | OFFLINE", type: 0 } });
			}
		}).catch(error => {
			console.error(error);
		});
	}
	
	function botUptime() {
		var n = new Date().toISOString();
		var diff = timediff(startTimeISO, n, 'DHm');
		client.user.setPresence({ game: { name: `Bot uptime ${diff.days}d ${diff.hours}h ${diff.minutes}m`, type: 0 } });
	}

	function botPresence(client) {
		tranquilityStatus();
		setTimeout(function() { botUptime(); }, 15000);
	}

	botPresence(client);
	setInterval(function() { botPresence(client); }, 25000);
});

client.on("message", async message => {
    if(message.author.bot) return;
	if(message.content.indexOf(data.prefix) !== 0) return;
	const args = message.content.slice(data.prefix.length).trim().split(/ +/g);
	const command = args.shift().toLowerCase();

	if(command === "auth") {
	    var user = client.user;
		var em = new Discord.RichEmbed();
			em.setTitle("Eve Mining OP Bot Auth")
			em.setColor("RANDOM")
			em.setThumbnail(user.displayAvatarURL)
			em.setFooter("Dont worry, we host this and its all our own code!")
			em.addField("Directions","Please complete the Eve Online authentication at the following URL. Once you have authenticated please return to discord and use the link command to link your EVE account to discord!",true)
			em.addField("Auth URL","http://149.56.225.38:5000/",true)
		message.author.send(em);
	}

	if(command === "link") {
		var ID = message.author.id;
		let charName = args.join(' ');
		if(!charName)
			return message.reply("Please include your in game character name to link it to your discord!");
		linkAccounts(ID,charName);
	}
	
	if(command === "register") {
		let fleetID = args[0];
		var ID = message.author.id; 
		if(!fleetID)
			return message.reply("Please include your fleet ID to register a fleet!");
		let fleetName = args.slice(1).join(' ');
		if(!fleetName)
		  return message.reply("Please include the name of the Fleet!");
		registerFleet(ID,fleetID,fleetName);		
	}

	if(command === "location") {
		
	}
	
});

client.login(data.token);
app.listen(5000, () => {
	console.info(`[ EJS ] : ${currentTime} : Eve Auth server started: http://149.56.225.38:5000/`);
});
