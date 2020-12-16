/*** Swarm RTS Util module - (c) mjh.at - v0.2.4 2014-12-27 ***/

var SwarmRTSComputerAi;
var SwarmRTSUtil;

/*jslint devel: true, browser: true, nomen: true*/
(function (module) {
    "use strict";

    var _Sector, _GridSystem, _EntitySystem,
        sectorSpiral;

    /*** SECTOR ***/
    module.Sector = function (sx, sy) {
        this.sx = sx;
        this.sy = sy;
        this.entities = [];
        this.entityCount = [0, 0, 0];
        this.entityCountSum = 0;
        this.entitySizeSum = 0;
    };
    _Sector = module.Sector.prototype;

    _Sector.equals = function (otherSector) {
        return this.sx === otherSector.sx && this.sy === otherSector.sy;
    };

    _Sector.registerEntity = function (entity) {
        this.entities.push(entity);
        this.entityCount[entity.faction] += 1;
        this.entityCountSum += 1;
        this.entitySizeSum += entity.size;
    };

    _Sector.removeEntity = function (entity) {
        var i;
        if ((i = this.entities.indexOf(entity)) >= 0) {
            this.entities.splice(i, 1);
            this.entityCount[entity.faction] -= 1;
            this.entityCountSum -= 1;
            this.entitySizeSum -= entity.size;
        } else {
            console.log("entity not found");
        }
    };

    _Sector.getEnemyEntityCount = function (myFaction) {
        return this.entityCountSum - this.entityCount[myFaction];
    };


    /*** GRIDSYSTEM ***/
    module.GridSystem = function (gridsX, gridsY, gridSize) {
        this.gridsX = gridsX;
        this.gridsY = gridsY;
        this.gridSize = gridSize;

        this.width = gridsX * gridSize;
        this.height = gridsY * gridSize;

        this.sectors = [];
        this.gridRandomizer = [];

        this.maximumSizeSumPerSector = gridSize * gridSize / 4;

        var sx, sy;

        // Initialize grid system
        for (sx = 0; sx < this.gridsX; sx += 1) {
            this.sectors[sx] = [];
            for (sy = 0; sy < this.gridsY; sy += 1) {
                this.sectors[sx][sy] = new module.Sector(sx, sy);
                this.gridRandomizer.push(sx * this.gridsY + sy);
            }
        }
    };
    _GridSystem = module.GridSystem.prototype;

    _GridSystem.getSectorSafe = function (sx, sy) {
        if (sx < 0 || sx >= this.gridsX || sy < 0 || sy >= this.gridsY) {
            return null;
        }
        return this.sectors[sx][sy];
    };

    _GridSystem.getSectorByCoord = function (x, y) {
        return this.sectors[Math.floor(x / this.gridSize)][Math.floor(y / this.gridSize)];
    };

    _GridSystem.getSectorByCoordSafe = function (x, y) {
        return this.getSectorSafe(Math.floor(x / this.gridSize), Math.floor(y / this.gridSize));
    };

    _GridSystem.getSectorByIndex = function (index) {
        return this.sectors[Math.floor(index / this.gridsY)][index % this.gridsY];
    };

    _GridSystem.getSectorsByRect = function (rect) {
        var i, j,
            sxMin = Math.floor(rect.x1 / this.gridSize),
            sxMax = Math.floor(rect.x2 / this.gridSize),
            syMin = Math.floor(rect.y1 / this.gridSize),
            syMax = Math.floor(rect.y2 / this.gridSize),
            result = [];

        for (i = sxMin; i <= sxMax; i += 1) {
            for (j = syMin; j <= syMax; j += 1) {
                result.push(this.sectors[i][j]);
            }
        }
        return result;
    };

    _GridSystem.getSectorsInRange = function (x, y, distance) {
        var i, j, c = 0,
            sx = Math.floor(x / this.gridSize),
            sy = Math.floor(y / this.gridSize),
            sxMin = Math.max(0, Math.floor((x - distance) / this.gridSize)),
            sxMax = Math.min(this.gridsX - 1, Math.floor((x + distance) / this.gridSize)),
            syMin = Math.max(0, Math.floor((y - distance) / this.gridSize)),
            syMax = Math.min(this.gridsY - 1, Math.floor((y + distance) / this.gridSize)),
            result = [ this.sectors[sx][sy] ];

        for (i = sxMin; i <= sxMax; i += 1) {
            for (j = syMin; j <= syMax; j += 1) {
                if (sx !== i || sy !== j) {
                    result[c += 1] = this.sectors[i][j];
                }
            }
        }
        return result;
    };

    /*jslint bitwise: true*/
    _GridSystem.randomLocationInAdjacentSector = function (x, y) {
        var r = Math.random() * 2 * Math.PI,
            nx = this.safeCoordX(x + Math.cos(r) * this.gridSize),
            ny = this.safeCoordY(y + Math.sin(r) * this.gridSize);

        return [nx, ny];
    };

    _GridSystem.safeCoordX = function (x) {
        return Math.max(1, Math.min(this.width - 1, x));
    };

    _GridSystem.safeCoordY = function (y) {
        return Math.max(1, Math.min(this.height - 1, y));
    };

    _GridSystem.getRandomSectorOrder = function () {
        module.shuffleArray(this.gridRandomizer);
        return this.gridRandomizer;
    };

    /*** ENTITY SYSTEM ***/

    module.EntitySystem = function () {

        this.unitCountSum = 0;
        this.unitCount = [0, 0, 0];
        this.unitLostCount = [0, 0, 0];
        this.computerAis = [null, null, null];

        this.units = [];
        this.spawners = [];

    };
    _EntitySystem = module.EntitySystem.prototype;

    _EntitySystem.initComputerAi = function () {
        this.computerAis[1] = new SwarmRTSComputerAi.ComputerAi(1, this);
        this.computerAis[2] = new SwarmRTSComputerAi.ComputerAi(2, this);
    };

    _EntitySystem.registerEntity = function (entity, spawner) {
        if (entity.type >= 10) {
            this.spawners.push(entity);
        } else {
            this.units.push(entity);
            this.unitCountSum += 1;
            this.unitCount[entity.faction] += 1;
            if (this.computerAis[entity.faction] !== null) {
                this.computerAis[entity.faction].registerUnit(entity, spawner);
            }
        }
    };

    _EntitySystem.removeEntity = function (entity) {
        var i;
        if (entity.type < 10) {
            if ((i = this.units.indexOf(entity)) >= 0) {
                this.removeUnitByIndex(i);
            }
        }
    };

    _EntitySystem.removeUnitByIndex = function (index) {
        var entity = this.units[index];
        this.units.splice(index, 1);
        this.unitCountSum -= 1;
        this.unitCount[entity.faction] -= 1;
        this.unitLostCount[entity.faction] += 1;
    };


    /*** MAIN UTILS ***/

    /**
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} x3
     */
    module.distance = function (x1, y1, x2, y2) {
        return Math.sqrt((x2 -= x1) * x2 + (y2 -= y1) * y2);
    };

    module.isPointInRect = function (x, y, rect) {
        if (x >= rect.x1 && x <= rect.x2 &&
                y >= rect.y1 && y <= rect.y2) {
            return true;
        }
        return false;
    };

    module.shuffleArray = function (array) {
        var i = array.length, j, t;
        while ((i -= 1) > 0) {
            j = Math.floor(Math.random() * i);
            t = array[i];
            array[i] = array[j];
            array[j] = t;
        }
    };

}(SwarmRTSUtil = SwarmRTSUtil || {}));



