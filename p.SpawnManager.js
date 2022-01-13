'use strict';
var _ProcessConstructor = require('p.ProcessConstructor');

class SpawnManager extends _ProcessConstructor.Process {
    constructor (roomService) {
        super("SpawnManager");
        this.roomService = roomService;
    }

    run () {
        let rooms = this.roomService.getAllofRoomType(ROOM_TYPE.MY);
        for (let room of rooms) {
            let spawns = _.filter(room.getMySpawns(), (s)=> s.isActive() && !s.spawning);
            if(spawns.length > 0) this.processQueue(room, spawns);
        }
    }

    processQueue(room, spawns) {
        if(room.memory.q === undefined) {
            room.memory.q = [];
            return;
        }
        let spawn = spawns[0];
        if(spawns.length === 0 ||  spawn.spawning || room.memory.q.length === 0) return;
        
        if (room.memory.q.length > 1) {
            room.memory.q.sort(function (a,b) {
            return ((a.pri > b.pri) ? 1 : ((b.pri > a.pri) ? -1 : 0));
            });
        }
        
        let order = room.memory.q.shift();
        if(order.duo !== undefined) {
            console.log('Here is double order in ' + room.name);
            room.memory.q.push(order);
            return;
        }
        if (order.cost > room.energyCapacityAvailable) {
            console.log('Too large order ' + order.role + ' in room ' + room.name);
            return;
        }
        if (order.cost > room.energyAvailable) {
            room.memory.q.push(order);
            return;
        }
        let answer = this.tryToSpawn(order, spawn);
        if (answer < 0) {
            if(answer === ERR_INVALID_ARGS || answer === ERR_NAME_EXISTS) return;
            room.memory.q.push(order);
            //console.log(answer);
            return;
        }
        console.log('</font><font color=green>Spawning ' + answer + ' in room ' + room.name + '</font>');
    }

    tryToSpawn(order, spawn) {
        let creepName = order.name || this.generateCreepName(order.role, spawn.room.name);
        let retVal;
        /*let body = [];
        switch(order.role) {
            case CREEP_ROLES.HARVESTER[0]:
                if (budjet > 800) budjet = 800;
                if (budjet === 300) {
                    body = [WORK,WORK,CARRY,MOVE];
                }
                else {

                    for(let i = 350; i <= budjet; i+= 150) {
                        body.push(WORK,MOVE);
                    }
                    body.push(WORK,CARRY,MOVE);
                }
                break;
        }*/

        retVal = spawn.spawnCreep(order.body, creepName, { memory: order.memory, dryRun: false});
        return (retVal < 0) ? retVal : creepName;
    }


    generateCreepName(role, spawnRoomName) {
        let name = "null";
        switch(role) {
            case CREEP_ROLES.HARVESTER[0]:
                name = CREEP_ROLES.HARVESTER[1] + (Math.floor(Math.random() * (1000 - 1)) + 1) + '_' + spawnRoomName;

                break;

        }
        return name;
    }
}

exports.SpawnManager = SpawnManager;


/*
    order = {
        pri: 0-6,
        duo: boolean,
        role: CREEP_ROLES[][0],
        cost: 0 - room.energyCapacityAvailable,
        memory: memory


    }





 */