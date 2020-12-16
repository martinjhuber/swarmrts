/*** Swarm RTS Entities module - (c) mjh.at - v0.3.1 2014-12-28 ***/

var SwarmRTSUtil;
var SwarmRTSEffects;
var SwarmRTSEntities;

/*jslint devel: true, browser: true, nomen: true*/
(function (module) {
    "use strict";

    var _Entity, _Unit, _Fighter, _Destroyer, _Spawner, _SpawnerHQ,
        locationGrid, destinationGrid, entitySystem;

    module.init = function (locationGridInstance, destinationGridInstance, entitySystemInstance) {
        locationGrid = locationGridInstance;
        destinationGrid = destinationGridInstance;
        entitySystem = entitySystemInstance;
    };

    /*** ENTITY ***/
    module.Entity = function (faction, x, y) {
        this.type = 0;

        this.faction = faction;

        this.x = x;
        this.y = y;
        this.sector = locationGrid.getSectorByCoord(x, y);

        this.destX = x;
        this.destY = y;
        this.destSector = destinationGrid.getSectorByCoord(this.destX, this.destY);
        this.isDestinationReserved = false;

        this.size = 0;

        this.time = 0;
        this.timePassed = 0;

    };
    _Entity = module.Entity.prototype;

    _Entity.update = function (timePassed) {
        this.time += timePassed;
        this.timePassed = timePassed;
    };

    _Entity.distance = function (entity) {
        return SwarmRTSUtil.distance(this.x, this.y, entity.x, entity.y);
    };

    _Entity.updateSector = function () {
        var newSector = locationGrid.getSectorByCoord(this.x, this.y);
        if (!this.sector.equals(newSector)) {
            this.sector.removeEntity(this);
            newSector.registerEntity(this);
            this.sector = newSector;
        }
    };

    _Entity.updateDestionationSector = function () {
        var newSector = destinationGrid.getSectorByCoord(this.destX, this.destY);
        if (!this.destSector.equals(newSector)) {
            this.destSector.removeEntity(this);
            newSector.registerEntity(this);
            this.destSector = newSector;
        }
    };

    _Entity.destruct = function () {
        this.sector.removeEntity(this);
        this.destSector.removeEntity(this);
    };

    _Entity.init = function () {
        this.sector.registerEntity(this);
        this.destSector.registerEntity(this);
        this.setDestination(this.destX, this.destY);
    };

    _Entity.setDestination = function (x, y) { };
    _Entity.isIdle = function () {
        return false;
    };


    /*** UNIT ***/
    module.Unit = function (faction, x, y) {
        module.Entity.call(this, faction, x, y);

        this.size = 2;
        this.health = 150;

        this.movePerSec = 24;
        this.attackDelaySec = 0.5;
        this.attackRange = 20;
        this.lookRange = 30;
        this.attackCriticalChance = 0.15;
        this.maxDamage = 20;
        this.minDamage = 10;
        this.evadeProbability = 0.6;
        this.blockPercentageNearFlag = 0.25;
        this.blockDurationNearFlagSec = 1;
        this.shootDurationSec = 0.1;

        this.state = 1; // 1 = alive, 2 = destroyed

        this.nextAttackTime = Math.random() * this.attackDelaySec;
        this.idleSince = 0;
        this.target = null;
        this.shootsTill = 0;
        this.targetDistance = 0;
        this.madeAutomaticMove = false;
        this.lastTimeNearOwnFlag = 0;

        // For Computer AI
        this.aiTarget = null;

    };
    module.Unit.prototype = Object.create(_Entity);
    _Unit = module.Unit.prototype;

    _Unit.parentDestruct = _Entity.destruct;
    _Unit.parentUpdate = _Entity.update;

    _Unit.update = function (timePassed) {
        this.parentUpdate(timePassed);

        if (!this.isDestinationReserved) {
            this.reserveDestination();
        }

        this.moveToDestination();

        if (this.time >= this.nextAttackTime) {
            this.nextAttackTime += this.attackDelaySec;
            this.searchTarget();
            if (this.target !== null) {
                this.attackTarget();
            }
        }
    };

    _Unit.moveToDestination = function () {

        if (this.x !== this.destX || this.y !== this.destY) {
            var totalDist = SwarmRTSUtil.distance(this.x, this.y, this.destX, this.destY),
                moveFactor = Math.min(this.movePerSec * this.timePassed, totalDist) / totalDist;

            this.x = locationGrid.safeCoordX(this.x + (this.destX - this.x) * moveFactor);
            this.y = locationGrid.safeCoordY(this.y + (this.destY - this.y) * moveFactor);

            this.updateSector();
            this.idleSince = this.time;
        }

    };

    /*jslint bitwise: true*/
    _Unit.reserveDestination = function () {

        var blockingEntity = null, s, e, sector, entity, r, destinationSectorsInRange,
            minDistFromBlocking, randomCloseCoord;

        if (this.destSector.entitySizeSum > destinationGrid.maximumSizeSumPerSector) {
            randomCloseCoord = destinationGrid.randomLocationInAdjacentSector(this.destX, this.destY);
            this.setDestination(randomCloseCoord[0], randomCloseCoord[1]);
            return;
        }

        destinationSectorsInRange = destinationGrid.getSectorsInRange(
            this.destX,
            this.destY,
            this.size >> 1
        );

outerLoop:
        for (s = 0; s < destinationSectorsInRange.length; s += 1) {
            sector = destinationSectorsInRange[s];
            for (e = 0; e < sector.entities.length; e += 1) {
                entity = sector.entities[e];
                if (this !== entity && SwarmRTSUtil.distance(this.destX, this.destY, entity.destX, entity.destY) < ((this.size + entity.size) >> 1)) {
                    blockingEntity = entity;
                    break outerLoop;
                }

            }
        }

        if (blockingEntity === null) {
            this.isDestinationReserved = true;
        } else {
            minDistFromBlocking = ((this.size + blockingEntity.size) >> 1) + 0.01;
            r = Math.random() * 2 * Math.PI;
            entity = this.size <= blockingEntity.size || blockingEntity.isDestinationReserved ||
                this.faction !== blockingEntity.faction ? this : blockingEntity;
            entity.setDestination(
                entity.destX + Math.cos(r) * minDistFromBlocking,
                entity.destY + Math.sin(r) * minDistFromBlocking
            );
        }

    };

    _Unit.setDestination = function (dx, dy) {
        var randomCloseCoord, newDestSector, searchDestSector, a;

        this.destX = destinationGrid.safeCoordX(dx);
        this.destY = destinationGrid.safeCoordY(dy);
        this.isDestinationReserved = false;

        /*
        newDestSector = destinationGrid.getSectorByCoord(this.destX, this.destY);

        if (newDestSector.entitySizeSum > destinationGrid.maximumSizeSumPerSector) {
            randomCloseCoord = destinationGrid.randomLocationInAdjacentSector(this.destX, this.destY);
            this.setDestination(randomCloseCoord[0], randomCloseCoord[1]);
        } else {
            this.updateDestionationSector();
        }
        */

        this.updateDestionationSector();

    };

    /*jslint bitwise: true*/
    _Unit.searchTarget = function () {

        var targetSectorsInRange, s, sector, e, entity, distanceToEntity,
            halfAttackRange = (this.attackRange >> 1);

        // skip one target search if the last one was extremely unsuccessful
        if (this.targetDistance > this.lookRange * 2) {
            this.targetDistance = this.lookRange + 1;
            return;
        }

        // keep using the same target
        if (this.target !== null && !this.target.isDestroyed() &&
                this.distance(this.target) <= this.lookRange) {
            this.targetDistance = this.distance(this.target);
            return;
        }

        this.targetDistance = 99999;
        this.target = null;

        targetSectorsInRange = locationGrid.getSectorsInRange(this.x, this.y, this.lookRange);

        for (s = 0; s < targetSectorsInRange.length; s += 1) {
            sector = targetSectorsInRange[s];

            if (sector.getEnemyEntityCount(this.faction) > 0) {

                for (e = 0; e < sector.entities.length; e += 1) {
                    entity = sector.entities[e];

                    if (entity.faction !== this.faction && entity.faction !== 0) {

                        distanceToEntity = this.distance(entity);
                        if (distanceToEntity < this.targetDistance) {
                            this.targetDistance = distanceToEntity;
                            this.target = entity;

                            if (distanceToEntity < halfAttackRange) {
                                return;
                            }
                        }

                    }
                }
            }
        }
    };

    _Unit.attackTarget = function () {

        if (this.targetDistance <= this.attackRange) {
            this.shootsTill = this.time + this.shootDurationSec;
            this.target.getShotAt(
                // base damage * critical factor
                (Math.random() * (this.maxDamage - this.minDamage) + this.minDamage) *
                    (Math.random() < this.attackCriticalChance ? 2 : 1)
            );
            this.idleSince = this.time;
        } else if (this.targetDistance <= this.lookRange) {
            this.setDestination(this.target.x, this.target.y);
            this.madeAutomaticMove = true;
        }

    };

    _Unit.getShotAt = function (damage) {
        if (Math.random() > this.evadeProbability) {
            if (this.lastTimeNearOwnFlag + this.blockDurationNearFlagSec > this.time) {
                this.health -= damage * (1 - this.blockPercentageNearFlag);
            } else {
                this.health -= damage;
            }

            if (this.health < 0) {
                this.state = 2;
                SwarmRTSEffects.effectSystem.registerEffect(
                    new SwarmRTSEffects.Explosion(0.5, this.x, this.y, this.size / 2, this.size * 1.2)
                );
                this.destruct();
            }
        }
    };

    _Unit.spawnerInfluence = function (spawner) {
        this.lastTimeNearOwnFlag = this.time;
    };

    _Unit.isDestroyed = function () {
        return this.state !== 1;
    };

    _Unit.idleTime = function () {
        return this.time - this.idleSince;
    };

    _Unit.isIdle = function () {
        return (this.idleTime() > 0.7);
    };

    /*** FIGHTER ***/
    module.Fighter = function (faction, x, y) {
        module.Unit.call(this, faction, x, y);
        this.type = 1;

    };
    module.Fighter.prototype = Object.create(_Unit);
    _Fighter = module.Unit.prototype;


    /*** DESTROYER ***/
    module.Destroyer = function (faction, x, y) {
        module.Unit.call(this, faction, x, y);
        this.type = 2;

        this.size = 6;
        this.health = 500;

        this.movePerSec = 18;
        this.attackDelaySec = 1;
        this.attackRange = 40;
        this.lookRange = 60;
        this.attackCriticalChance = 0.25;
        this.maxDamage = 150;
        this.minDamage = 80;
        this.evadeProbability = 0.1;

        this.nextAttackTime = Math.random() * this.attackDelaySec;

        this.angle = 0;

    };
    module.Destroyer.prototype = Object.create(_Unit);
    _Destroyer = module.Unit.prototype;

    _Destroyer.parentSetDestination = _Unit.setDestination;

    _Destroyer.setDestination = function (dx, dy) {
        this.parentSetDestination(dx, dy);

        if (this.x !== this.destX || this.y !== this.destY) {
            this.angle = Math.atan2(this.destY - this.y, this.destX - this.x) - Math.PI / 2;
        }
    };

    /*** SPAWNER ***/
    module.Spawner = function (capturedByFaction, x, y) {
        module.Entity.call(this, 0, x, y);
        this.type = 10;

        this.size = 12;

        this.spawnPerSec = 8;
        this.captureCheckIntervalSec = 0.5;
        this.capturePerSecAndUnit = 1;
        this.neutralizePerSecAndUnit = 2;

        this.spawnProbabilities = [0.98, 1.00];
        this.spawnTypes = [SwarmRTSEntities.Fighter, SwarmRTSEntities.Destroyer];

        this.captureRadius = 70;
        this.capturePoints = 10000;
        this.maxUnitsCapture = 750;
        this.spawnOnCapture = 100;

        this.capturedByFaction = capturedByFaction;
        this.capturePointStatus = this.capturePoints;

        this.nextCaptureCheckTime = Math.random() * this.captureCheckIntervalSec;
        this.lastCaptureTime = 0;

        this.lastCaptureSpawnedUnits = 0;

    };
    module.Spawner.prototype = Object.create(_Entity);
    _Spawner = module.Entity.prototype;

    _Spawner.parentUpdate = _Entity.update;
    _Spawner.parentInit = _Entity.init;

    _Spawner.init = function () {
        this.parentInit();
        this.lastCaptureSpawnedUnits = 0;
        this.lastCaptureTime = this.time;
        this.nextCaptureCheckTime = this.time + Math.random() * this.captureCheckIntervalSec;
        this.producesUnits = this.capturedByFaction !== 0;
        this.capturePointStatus = this.capturedByFaction !== 0 ? this.capturePoints : 0;
    };

    _Spawner.update = function (timePassed) {
        this.parentUpdate(timePassed);

        var spawnGoal;

        if (this.nextCaptureCheckTime <= this.time) {
            this.nextCaptureCheckTime += this.captureCheckIntervalSec;
            this.checkCaptureStatus();
        }

        spawnGoal = Math.floor((this.time - this.lastCaptureTime) * this.spawnPerSec);

        if (this.producesUnits && spawnGoal > this.lastCaptureSpawnedUnits) {
            this.spawnUnits(spawnGoal - this.lastCaptureSpawnedUnits, false);
        }

    };

    _Spawner.spawnUnits = function (amount, spawnAtDestination) {
        var i, typeRandomValue, typeId, Type, t, u, r, unit, destX, destY;

        for (i = 0; i < amount; i += 1) {

            typeRandomValue = Math.random();
            for (typeId = 0; typeId < this.spawnProbabilities.length; typeId += 1) {
                if (typeRandomValue < this.spawnProbabilities[typeId]) {
                    Type = this.spawnTypes[typeId];
                    break;
                }
            }
            t = 2 * Math.PI * Math.random();
            u = Math.random() + Math.random();
            r = u > 1 ? 2 - u : u;

            destX = r * Math.cos(t) * this.captureRadius + this.x;
            destY = r * Math.sin(t) * this.captureRadius + this.y;

            unit = new Type(
                this.capturedByFaction,
                spawnAtDestination ? destX : this.x,
                spawnAtDestination ? destY : this.y
            );

            unit.init();

            unit.setDestination(destX, destY);

            entitySystem.registerEntity(unit, this);
        }

        this.lastCaptureSpawnedUnits += amount;
    };

    _Spawner.checkCaptureStatus = function () {
        var captureSectors, s, e, sector, entity, factionUnits = [0, 0, 0],
            maxFaction = 0, maxFactionUnits = 0, maxFactionDiff = 0,
            notFullyCaptured = !this.isFullyCaptured();

        captureSectors = locationGrid.getSectorsInRange(this.x, this.y, this.captureRadius);
        for (s = 0; s < captureSectors.length; s += 1) {
            sector = captureSectors[s];

            for (e = 0; e < sector.entities.length; e += 1) {
                entity = sector.entities[e];
                if (this.distance(entity) < this.captureRadius) {
                    factionUnits[entity.faction] += 1;

                    if (maxFaction !== entity.faction &&
                            factionUnits[entity.faction] > maxFactionUnits) {
                        maxFaction = entity.faction;
                        maxFactionDiff = 1;
                        maxFactionUnits = factionUnits[entity.faction];
                    } else if (maxFaction === entity.faction) {
                        maxFactionDiff += 1;
                        maxFactionUnits = factionUnits[entity.faction];
                    }

                    if (notFullyCaptured) {
                        entity.idleSince = entity.time;
                    } else if (this.capturedByFaction === entity.faction) {
                        entity.spawnerInfluence(this);
                    }
                }
            }
        }

        maxFactionDiff = Math.min(this.maxUnitsCapture, maxFactionDiff);

        if (maxFaction === 0) {
            return;
        } else if (maxFaction !== this.capturedByFaction) {

            this.capturePointStatus -= this.neutralizePerSecAndUnit *
                this.captureCheckIntervalSec * maxFactionDiff;

            if (this.capturePointStatus <= 0) {
                this.capturePointStatus = 0;
                this.capturedByFaction = maxFaction;
                this.producesUnits = false;
            }
        } else if (this.capturePointStatus < this.capturePoints) {

            this.capturePointStatus += this.capturePerSecAndUnit *
                this.captureCheckIntervalSec * maxFactionDiff;

            if (this.capturePointStatus >= this.capturePoints) {
                this.capturePointStatus = this.capturePoints;
                if (!this.producesUnits) {
                    this.spawnUnits(this.spawnOnCapture, false);
                    this.lastCaptureSpawnedUnits = 0;
                    this.lastCaptureTime = this.time;
                    this.producesUnits = true;
                }
            }
        }
    };

    _Spawner.isFullyCaptured = function () {
        return this.producesUnits;
    };

    _Spawner.getSectorsInRange = function (distance) {
        return locationGrid.getSectorsInRange(this.x, this.y, distance);
    };

    /*** SPAWNER HQ ***/
    module.SpawnerHQ = function (capturedByFaction, x, y) {
        module.Spawner.call(this, capturedByFaction, x, y);
        this.type = 11;

        this.captureRadius = 80;
        this.spawnPerSec = 16;
        this.capturePoints = 12500;
    };
    module.SpawnerHQ.prototype = Object.create(_Spawner);
    _SpawnerHQ = module.Spawner.prototype;



}(SwarmRTSEntities = SwarmRTSEntities || {}));


