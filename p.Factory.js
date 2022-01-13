"use strict";
var _processConstructor = require('p.ProcessConstructor');
var _transferOrder = require('lib.transferOrders');
const START_PROCESS_BASE_MINERALS = 10000;
const START_UNPACK_COMMODITY = 3000;
const BASE_COMMODITY_STOP_AT = 30000;
const MIN_FACTORY_AMOUNT = 0;
const BATCH_SIZE_MULTIPLIER = 10;
class FactoryProcessing extends _processConstructor.Process {
    constructor (roomService, creepService) {
        super("FactoryProcessing");
        this.MEMORY_LASTRUN = "lastrun";
        this.roomService = roomService;
        this.creepService = creepService;
    }

    run (priority) {
        let rooms = this.roomService.getAllofRoomType(ROOM_TYPE.MY);
        switch (priority) {
            case PROCESS_PRIORITY.SECONDARY:
                for (let room of rooms) {

                    if (room.controller.level >= 7 && room.getFactory() !== undefined) {
                        if(room.memory.factory === undefined) room.memory.factory = {};
                        if(room.memory.factory.sleep === undefined) room.memory.factory.sleep = 0;
                        if (room.memory.factory.sleep > Game.time) continue;
                        processFactory(room);
                    }
                }
                break;
            case PROCESS_PRIORITY.USELESS:
                for (let room of rooms) {

                    if (room.controller.level >= 7 && room.getFactory() !== undefined) {
                        if(room.memory.factory === undefined) room.memory.factory = {};
                        if(room.memory.factory.sleep === undefined) room.memory.factory.sleep = 0;
                        if(room.memory.factory.commodity !== undefined) drawVisuals(room);
                    }
                }
        }
    }
}
exports.FactoryProcessing = FactoryProcessing;

function processFactory(room) {
    if (room.memory.factory.status === undefined) room.memory.factory.status = LAB_STATUS.IDLE;
    let status = room.memory.factory.status;

    switch (status) {
        case LAB_STATUS.LOAD:
            if (checkBatch(room)) room.memory.factory.status = LAB_STATUS.RUN;
            break;
        case LAB_STATUS.RUN:
            //runFactory(room);
            checkBatch(room);
            break;
        case LAB_STATUS.UNLOAD:
            unloadFactory(room);
            room.memory.factory.commodity = undefined;
            room.memory.factory.cycle = undefined;
            room.memory.factory.sleep = 0;
            room.memory.factory.status = LAB_STATUS.IDLE;
            break;
        default:
            if (room.memory.factory.commodity === undefined) {
                room.memory.factory.commodity = getCommodityForProducing(room);
            }
            checkBatch(room);
    }


}


function getCommodityForProducing (room) {
    let factory = room.getFactory();
    let factorylvl = factory.level ? factory.level : undefined;//fix that shit for recipes compatibility
    let check = null;
    let recipes = _.shuffle(Object.keys(COMMODITIES));
    let requestVal = -1;
    for (let index = recipes.length - 1; index >= 0; index--) {
        check = undefined;
        if (recipes[index] === RESOURCE_GHODIUM) continue; //fuck that shit
        if (isBaseMineral(recipes[index]) && room.getResource(recipes[index]) >= START_UNPACK_COMMODITY) continue; // start unpack base minerals if below
        if (COMMODITIES[recipes[index]].level !== undefined) { //check for factory lvl recipes
            if (COMMODITIES[recipes[index]].level !== factorylvl) continue;
            if (room.getResource(recipes[index]) >= BASE_COMMODITY_STOP_AT / (COMMODITIES[recipes[index]].level + 1)) continue; //stop for high lvl recipes
        }
        else if (room.getResource(recipes[index]) >= BASE_COMMODITY_STOP_AT) continue; //stop for recipes w/o level
        for (let component in COMMODITIES[recipes[index]].components) {
            if (component === RESOURCE_ENERGY) continue;
            if (isBaseMineral(component) && room.getResource(component) < START_PROCESS_BASE_MINERALS) continue;
            let batch = COMMODITIES[recipes[index]].level === undefined ?
                BATCH_SIZE_MULTIPLIER : Math.ceil(1000 / COMMODITIES[recipes[index]].cooldown);
            if (room.getResource(component) < COMMODITIES[recipes[index]].components[component] * batch) {
                let needed = COMMODITIES[recipes[index]].components[component] * batch - room.getResource(component);
                let safeAmount = needed;
                if (isBaseMineral(component) || isFromBaseMineral(component)) {
                    needed = TERMINAL_MAX_RESOURCE;
                    safeAmount = TERMINAL_MAX_RESOURCE;
                }
                if (COMMODITIES[recipes[index]].level !== undefined) safeAmount = 1;
                requestVal = room.requestMineral(component, Math.min(needed, TERMINAL_MAX_RESOURCE), safeAmount); //request ingredients from other rooms
                check = undefined;
                break;
            }
            else check = recipes[index];

        }
        if (check === recipes[index]) return check;
        if (requestVal === OK) break;
    }
    return undefined;
}
function isBaseMineral(component) {
    return !!BASE_MINERALS.includes(component);
}
function isFromBaseMineral(component) {
    switch(component) {
        case RESOURCE_UTRIUM_BAR:
        case RESOURCE_LEMERGIUM_BAR:
        case RESOURCE_ZYNTHIUM_BAR:
        case RESOURCE_KEANIUM_BAR:
        case RESOURCE_GHODIUM_MELT:
        case RESOURCE_OXIDANT:
        case RESOURCE_REDUCTANT:
        case RESOURCE_PURIFIER:
        case RESOURCE_BATTERY:
            return true;
        default:
            return false;
    }
}

function checkBatch (room) {
    if (room.memory.factory === undefined) return false;
    if (room.memory.factory.commodity === undefined) {
        room.memory.factory.status = 0;
        room.memory.factory.sleep = Game.time + 50;
        return false;
    }
    if (room.memory.factory.commodity && room.memory.factory.cycle === undefined) {
        room.memory.factory.cycle = COMMODITIES[room.memory.factory.commodity].level === undefined ?
            BATCH_SIZE_MULTIPLIER : Math.ceil(1000 / COMMODITIES[room.memory.factory.commodity].cooldown);
        console.log('</font><font color=#1e90ff>FACTORY: ' + room.memory.factory.commodity + ' scheduled in room ' + room.name + '</font>');
        loadFactory(room);
        room.memory.factory.status = LAB_STATUS.LOAD;
        return false;
    }
    if (room.memory.factory.commodity && room.memory.factory.cycle > 0) {
        let factory = room.getFactory();
        let check = false;
        for (let component in COMMODITIES[room.memory.factory.commodity].components) {
            if (factory.store[component] >= COMMODITIES[room.memory.factory.commodity].components[component]) {
                check = true;
            }
            else check = false;
            
        }
        if (check) {
            room.memory.factory.status = LAB_STATUS.RUN;
            runFactory(room);
            return check;
        }
        else {
            if (room.memory.factory.status === LAB_STATUS.IDLE) {
                console.log('</font><font color=#1e90ff>FACTORY: Shit happens in ' + room.name + 'purging all.</font>');
                unloadFactory(room);
                room.memory.factory.commodity = undefined;
                room.memory.factory.cycle = undefined;
                return false;
            }
        }
    }
    if (room.memory.factory && room.memory.factory.commodity && room.memory.factory.cycle <= 0) {
        console.log('</font><font color=#1e90ff>FACTORY: ' + room.memory.factory.commodity + ' finished in room ' + room.name + '</font>');
        room.memory.factory.status = LAB_STATUS.UNLOAD;
        return false;
    }
}

function loadFactory (room) {
    let factory = room.getFactory();
    room.memory.factory.sleep = Game.time;
    for (let component in COMMODITIES[room.memory.factory.commodity].components) {
        if (component === RESOURCE_ENERGY) continue;
        let amount = COMMODITIES[room.memory.factory.commodity].components[component] * room.memory.factory.cycle;
        if (factory.store[component] < amount) {
            let needed = amount - factory.store[component];
            if (room.getResource(component) < needed) {
                console.log('</font><font color=#1e90ff>FACTORY: Shit happens in ' + room.name + '. Purging all.</font>');
                unloadFactory(room);
                room.memory.factory.commodity = undefined;
                room.memory.factory.cycle = undefined;
                room.memory.factory.sleep = 0;
                return;
            }
            let fromStorage = Math.min(getStructuresWithResource(room, component)[0], needed);
            let order = undefined;
            if (fromStorage > 0) {
                order = _transferOrder.generateTransferOrder(room.storage.id, factory.id, component, fromStorage);
                if (!_transferOrder.isTransferOrderExists(room, order)) room.memory.tq.push(order);
            }
            if (needed - fromStorage !== 0) {
                order = _transferOrder.generateTransferOrder(room.terminal.id, factory.id, component, needed - fromStorage);
                if (!_transferOrder.isTransferOrderExists(room, order)) room.memory.tq.push(order);
            }
            room.memory.factory.sleep += 10;
        }
    }
}

function unloadFactory (room) {
    let factory = room.getFactory();
    console.log('</font><font color=#1e90ff>FACTORY: checking for unload ' + room.memory.factory.commodity + ' in room ' + room.name + '</font>');
    for (let resource in factory.store) {
        if (factory.store[resource] !== MIN_FACTORY_AMOUNT) {
            if(resource === RESOURCE_ENERGY) continue;
            let quanity = 0;
            if(!isFromBaseMineral(resource)) quanity = factory.store[resource];
            else quanity = factory.store[resource] > MIN_FACTORY_AMOUNT ?
                factory.store[resource] - MIN_FACTORY_AMOUNT : factory.store[resource];
            let order = _transferOrder.generateTransferOrder(factory.id, room.terminal.id, resource, quanity);
            if (!_transferOrder.isTransferOrderExists(room, order)) room.memory.tq.push(order);
        }
    }
}

function runFactory (room) {
    
    let factory = room.getFactory();
    let result = factory.produce(room.memory.factory.commodity);
    if (result === ERR_TIRED) room.memory.factory.sleep = Game.time + factory.cooldown - 1;
    if (result === ERR_BUSY) room.memory.factory.buff = 1;
    else room.memory.factory.buff = 0;
    if (result === ERR_NOT_ENOUGH_RESOURCES) {
        room.memory.factory.status = LAB_STATUS.LOAD;
        loadFactory(room);

    }
    if (result === OK) {
        room.memory.factory.cycle -= 1;
        room.memory.factory.sleep = Game.time + COMMODITIES[room.memory.factory.commodity].cooldown - 1;
    }
    //console.log(result + room.name);
}

function getStructuresWithResource (room, resourceType) {
    let array = [2];
    if (room.storage) array[0] = room.storage.store[resourceType];
    if (room.terminal) array[1] = room.terminal.store[resourceType];
    return array;
}

function drawVisuals(room) {
    let overlay = new RoomVisual(room.name);
    overlay.text(room.memory.factory.commodity, room.getFactory().pos.x, room.getFactory().pos.y, {color: "#1e90ff", font: 0.4, backgroundColor: 'black', opacity: 0.7});
}