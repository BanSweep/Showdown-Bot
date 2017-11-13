let fs = require("fs");
let request = require("request");
let self = {js:{},data:{},requiredBy:[],hooks:{},config:{}};
let ranks = [" ", "+", "%", "@", "*", "&", "#", "~"];
let chat = null;
let auth = null;
exports.onLoad = function(module, loadData){
	self = module;
	self.js.refreshDependencies();
	if(loadData){
		self.data = {modulesToLoad: []};
		loadModuleList();
		loadAllModules();
	}
	self.chathooks = {
		chathook: function(m){
			if(m && !m.isInit){
				let text = m.message;
				if(text[0] === "~"){
					let words = text.split(" ");
					let command = words.shift().trim().toLowerCase().substr(1);
					let argText = words.join(" ");
					let chatArgs = argText === "" ? [] : argText.split(",").map(function(item){
						return item.trim();
					});
					if(commands[command] && auth && auth.js){
						commands[command](m, chatArgs);
					}else if(commands[command] && idsMatch(m.user,mainConfig.owner)){
						let response = "Circumvented auth check. Result: ";
						response += managerFuncs[command](chatArgs[0]);
						if(chat && chat.js){
							chat.js.reply(m, response);
						}else{
							info(response);
						}
					}
				}
			}
		}
	};

};
exports.onUnload = function(){

};
exports.refreshDependencies = function(){
	chat = getModuleForDependency("chat", "modulemanager");
	auth = getModuleForDependency("auth", "modulemanager");
};
exports.onConnect = function(){

};

let commands = {
	load: function(message, args){
		let response = "Your rank is not high enough to load modules.";
		if(auth.js.rankgeq(auth.js.getGlobalRank(message.user),"#")){
			response = "You must specify the module to be loaded.";
			if(args.length>0){
				response = managerFuncs.load(args[0]);
			}
		}
		if(chat&&chat.js){
			chat.js.reply(message, response);
		}
	},
	reload: function(message, args){
		let response = "Your rank is not high enough to load modules.";
		if(auth.js.rankgeq(auth.js.getGlobalRank(message.user),"#")){
			response = "You must specify the module to be loaded.";
			if(args.length>0){
				response = managerFuncs.reload(args[0]);
			}
		}
		if(chat&&chat.js){
			chat.js.reply(message, response);
		}
	},
	unload: function(message, args){
		let response = "Your rank is not high enough to unload a module.";
		if(auth.js.rankgeq(auth.js.getGlobalRank(message.user),"#")){
			response = "You must specify the module to unload.";
			if(args.length>0){
				response = managerFuncs.unload(args[0]);
			}
		}
		if(chat&&chat.js){
			chat.js.reply(message, response);
		}
	},
	config: function(message, args){
		let response;
		if(!auth.js.rankgeq(auth.js.getGlobalRank(message.user),"#")){
			chat.js.reply(message, "Your rank is not high enough to manage configs.");
		}else if(args.length < 2){
			chat.js.reply(message, "You must give a config command and a module name.");
		}else{
			let command = args[0].toLowerCase();
			if(configFuncs[command]){
				configFuncs[command](message, args.slice(1));
			}
		}
	}
};

let managerFuncs = {
	load: function(name){
		let moduleName = toId(name);
		let result = loadModule(moduleName,true);
		let response = "Something is wrong if you see this.";
		if(result && moduleName !== "modulemanager"){
			if(self.data.modulesToLoad.indexOf(moduleName) === -1){
				self.data.modulesToLoad.add(moduleName);
				saveModuleList();
				response = "Successfully loaded the module " + name + ".";
			}else{
				response = "Successfully reloaded the module " + name + " and its data.";
			}
		}else if(result){
			response = "Successfully loaded the module manager.";
		}else{
			response = "Could not load the module " + name + ".";
		}
		return response;
	},
	reload: function(name){
		let moduleName = toId(name);
		let response = "Could not reload the module " + name + ".";
		if(!modules[moduleName] || (self.data.modulesToLoad.indexOf(moduleName) === -1 && moduleName !== "modulemanager")){
			response = managerFuncs.load(moduleName);
		}else{
			let result = loadModule(moduleName,false);
			if(result && moduleName !== "modulemanager"){
				response = "Successfully reloaded the module " + name + ".";
			}else if(result){
				response = "Successfully reloaded the module manager.";
			}
		}
		return response;
	},
	unload: function(name){
		let moduleName = toId(name);
		let result = unloadModule(moduleName);
		let response = "Could not unload the module " + name + ".";
		if(result){
			response = "Successfully unloaded the module " + name + ".";
			let index = self.data.modulesToLoad.indexOf(moduleName);
			if(index !== -1){
				self.data.modulesToLoad.splice(index,1);
				saveModuleList();
			}
		}
		return response;
	},
	config: function(name){
		let result = loadConfig(name);
		let response = "Could not reload the config for " + name + ".";
		if(result){
			response = "Successfully reloaded the config for " + name + ".";
		}
		return response;
	}
}

let configFuncs = {
	reload: function(message, args){
		let name = toId(args[0]);
		if(name){
			chat.js.reply(message, managerFuncs.config(name));
		}else{
			chat.js.reply(message, "You need to give a proper module name.");
		}
	},
	list: function(message, args){
		let name = toId(args[0]);
		if(name){
			let module = modules[name];
			if(module){
				let configs = [];
				for(let config in module.config){
					configs.push(config + ": " + module.config[config]);
				}
				request.post({url:'https://hastebin.com/documents', body: configs.join("\n")}, function(err,httpResponse,body){
					if(err){
						chat.js.reply(message, "There was an errer in the response from hastebin.");
					}
					chat.js.pm(message.user, "hastebin.com/" + JSON.parse(body).key);
				});
			}else{
				chat.js.reply(message, "That module does not exist.");
			}
		}else{
			chat.js.reply(message, "You need to give a proper module name.");
		}
	},
	set: function(message, args){
		let name = toId(args[0]);
		if(args.length<3){
			chat.js.reply(message, "You must give the module, the property, and the value.");
		}else if(name && modules[name]){
			let module = modules[name];
			let property = args[1];
			if(module.config[property]){
				let value = getProperty(args[2], module.js.configTypes[property]);
				if(value){
					module.config[property] = value;
					saveConfig(name);
					chat.js.reply(message, "Successfully set the " + property + " property of " + name + " to " + value + ".");
				}else{
					chat.js.reply(message, "You must give a proper value for that property.");
				}
			}else{
				chat.js.reply(message, "The property you gave does not exist.");
			}
		}else{
			chat.js.reply(message, "That module does not exist.");
		}
	},
	update: function(message, args){
		let name = toId(args[0]);
		if(args.length<2){
			chat.js.reply(message, "You must give the module, and a link to a hastebin raw paste.");
		}else if(!name || !modules[name]){
			chat.js.reply(message, "The module '" + name + "' does not exist.");
		}else if(/^(https?:\/\/)?(www\.)?hastebin.com\/raw\/[a-z]+$/.test(args[1])){
			let module = modules[name];
			let response = "Finished updating the configs.";
			request.get(args[1],function(err, response2, body){
				if(err){
						error(err);
						chat.js.reply(message, err);
						return;
				}
				let configs = body.split("\n");
				for(let i=0;i<configs.length;i++){
					let config = configs[i].split(":");
					let property = config[0];
					if(module.config[property]){
						let value = getProperty(config[1].trim(), module.js.configTypes[property]);
						if(value){
							module.config[property] = value;
						}else{
							response = "Invalid value given for " + property + ".";
							info(module.js.configTypes[property])
							info(config[1]);
							info(value);
							error(response);
						}
					}else{
						response = "The property " + property + " doesn't exist.";
						error(response);
					}
				}
				chat.js.pm(message.user, response);
			});
		}else{
			chat.js.reply(message, "There was something wrong with your link, make sure it's only the raw paste.");
		}
	}
};

let loadModuleList = function(){
		try{
			let filename = "data/modules.json";
			if(fs.existsSync(filename)){
				self.data.modulesToLoad = JSON.parse(fs.readFileSync(filename, "utf8"));
				ok("Successfully loaded the module list.");
			}else{
				self.data.modulesToLoad = [];
				let moduleFile = fs.openSync(filename,"w");
				fs.writeSync(moduleFile,JSON.stringify(self.data.modulesToLoad, null, "\t"));
				fs.closeSync(moduleFile);
				error("No module list found, saved a new one.")
			}
		}catch(e){
			error(e.message);
			error("Could not load the module list.")
		}
};

let saveModuleList = function(){
	try{
		let filename = "data/modules.json";
		let moduleFile = fs.openSync(filename,"w");
		fs.writeSync(moduleFile,JSON.stringify(self.data.modulesToLoad, null, "\t"));
		fs.closeSync(moduleFile);
		ok("Saved the module list.");
	}catch(e){
		error(e.message);
		error("Could not save the module list.");
	}
};

let loadAllModules = function(){
	for(let i=0;i<self.data.modulesToLoad.length;i++){
		let moduleName = self.data.modulesToLoad[i];
		let result = loadModule(moduleName, true);
		if(!result){
			self.data.modulesToLoad.splice(i,1);
			i--;
			error("Could not load the module '" + moduleName + "'.");
			continue;
		}
		ok("Loaded the module '" + moduleName + "'.");
	}
};

let getProperty = function(valueStr, type){
	if(type === "string"){
		return valueStr;
	}else if(type === "int"){
		return /^[0-9]+$/.test(valueStr) ? parseInt(valueStr) : null;
	}else if(type === "rank"){
		if(ranks.indexOf(valueStr) !== -1){
			return valueStr;
		}else if(!valueStr){
			return " ";
		}else{
			return null;
		}
	}else{
		return null;
	}
}

let defaultConfigs = {
	loadModuleRank: "#"
};

exports.defaultConfigs = defaultConfigs;

let configTypes = {
	loadModuleRank: "rank"
};

exports.configTypes = configTypes;
