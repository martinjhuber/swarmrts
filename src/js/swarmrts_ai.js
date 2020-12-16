/*** Swarm RTS AI module - (c) mjh.at - v0.3.2 2014-12-28 ***/

var SwarmRTSComputerAi;
var SwarmRTSUtil;

/*jslint devel: true, browser: true, nomen: true*/
(function (module) {
    "use strict";

    var _ComputerAi,
        Strategy = {
            Defend : 10,
            Maintain : 20,
            Attack : 30
        },
        DEBUG = false;

    module.ComputerAi = function (faction, entitySystem) {
        this.faction = faction;
        this.entitySystem = entitySystem;

        this.time = 0;
        this.planRate = 2; // every 2 seconds

        this.nextPlanTime = Math.random() * this.planRate / 4 + 0.25;

        this.strategy = Strategy.Attack;

        this.spawnerAnalysis = [];
        this.spawnerDistances = [];

        this.prioritySum = 0;
        this.unitBalance = 1;

        this.maxDesignations = 1;

    };
    _ComputerAi = module.ComputerAi.prototype;

    _ComputerAi.init = function () {
        this.analyzeSpawners();

        // Specifies how many targets are chosen by the AI
        this.maxDesignations = Math.max(1, Math.floor((this.spawnerAnalysis.length - 1) / 2));
    };

    _ComputerAi.analyzeSpawners = function () {
        var s, i, spawner, distance, numOtherSpawners = 0, sumOfDistances = 0,
            sortFunc;

        this.spawnerAnalysis = [];
        this.spawnerDistances = [];

        // Find my HQ(s)
        for (s = 0; s < this.entitySystem.spawners.length; s += 1) {
            spawner = this.entitySystem.spawners[s];

            if (this.faction === spawner.capturedByFaction) {

                this.spawnerAnalysis.push({
                    distanceToHq : 0,
                    object : spawner,
                    sectors : spawner.getSectorsInRange(spawner.captureRadius * 1.3),
                    priority : 0,
                    enemyDepth : 0,
                    unitsToSend : 0,
                    unitCounts : [0, 0]
                });
            }
        }

        if (this.spawnerAnalysis.length === 0) {
            console.error("No HQ found! What kind of game should that be?!");
            return;
        }

        // Find all other spawners
        for (s = 0; s < this.entitySystem.spawners.length; s += 1) {
            spawner = this.entitySystem.spawners[s];

            if (spawner !== this.spawnerAnalysis[0].object) {
                // distance from HQ
                distance = spawner.distance(this.spawnerAnalysis[0].object);
                this.spawnerAnalysis.push({
                    distanceToHq : distance,
                    object : spawner,
                    sectors : spawner.getSectorsInRange(spawner.captureRadius * 1.5),
                    priority : 0,
                    enemyDepth : 0,
                    unitsToSend : 0,
                    unitCounts : [0, 0]
                });
                sumOfDistances += distance;
                numOtherSpawners += 1;
            }
        }

        // Sort spawners by distance to HQ
        sortFunc = function (s1, s2) { return s1.distanceToHq - s2.distanceToHq; };
        this.spawnerAnalysis.sort(sortFunc);

        // Store distances between each spawner pair
        sortFunc = function (s1, s2) { return s1.distance - s2.distance; };
        for (s = 0; s < this.spawnerAnalysis.length; s += 1) {
            this.spawnerDistances[s] = [];
            for (i = 0; i < this.spawnerAnalysis.length; i += 1) {
                this.spawnerDistances[s][i] = {
                    index : i,
                    distance : this.spawnerAnalysis[s].object.distance(this.spawnerAnalysis[i].object)
                };
            }
            this.spawnerDistances[s].sort(sortFunc);
        }

        if (DEBUG) {
            console.log("AI", this.faction, "spawnerAnalysis", this.spawnerAnalysis);
            console.log("AI", this.faction, "spawnerDistances", this.spawnerDistances);
        }
    };

    _ComputerAi.update = function (timePassed) {
        this.time += timePassed;

        if (this.time >= this.nextPlanTime) {
            this.nextPlanTime += this.planRate;

            this.determineStrategy();
            this.specifyTargets();
            this.sendUnits();
        }
    };

    _ComputerAi.getUnitCount = function (sectors) {
        var s, i, result = [0, 0];
        for (s = 0; s < sectors.length; s += 1) {
            for (i = 1; i < sectors[s].entityCount.length; i += 1) {
                result[1] += sectors[s].entityCount[i];
            }
            result[0] += sectors[s].entityCount[this.faction];
        }
        result[1] -= result[0];
        return result;
    };

    _ComputerAi.determineStrategy = function () {
        var s, balanceChange, spawner, spawnerBalance = 0, globalMyUnitCount,
            enemySpawnerDepth = 0;

        //this.spawnersCaptured = 0;

        for (s = 0; s < this.spawnerAnalysis.length; s += 1) {
            spawner = this.spawnerAnalysis[s].object;

            balanceChange = 0;
            if (spawner.capturedByFaction === this.faction) {
                balanceChange = 1;
                //this.spawnersCaptured += 1;
            } else if (spawner.capturedByFaction !== 0) {
                balanceChange = -1;
            }
            if (!spawner.isFullyCaptured()) {
                balanceChange *= 0.5;
            }
            spawnerBalance += balanceChange;

            if (spawner.capturedByFaction !== 0 && spawner.capturedByFaction !== this.faction) {
                enemySpawnerDepth += 1;
            }
            this.spawnerAnalysis[s].enemyDepth = enemySpawnerDepth;
            this.spawnerAnalysis[s].unitCounts = this.getUnitCount(this.spawnerAnalysis[s].sectors);
        }

        globalMyUnitCount = this.entitySystem.unitCount[this.faction];
        this.unitBalance = globalMyUnitCount / (this.entitySystem.unitCountSum - globalMyUnitCount);

        if ((spawnerBalance <= -1 && this.unitBalance < 0.9) || this.unitBalance < 0.75) {
            this.strategy = Strategy.Defend;
        } else if (spawnerBalance >= 0 && this.unitBalance > 1.1) {
            this.strategy = Strategy.Attack;
        } else {
            this.strategy = Strategy.Maintain;
        }

        if (DEBUG) {
            console.log("AI", this.faction, "determines best strategy is", this.strategy,
                        "(10=D,20=M,30=A) - spawnerBalance", spawnerBalance, "unitBalance",
                        this.unitBalance);
        }

    };

    _ComputerAi.specifyTargets = function () {
        var s,
            globalMyUnitCount = this.entitySystem.unitCount[this.faction];

        this.prioritySum = 0;

        if (this.strategy === Strategy.Defend) {
            this.specifyTargetsDefend();
        } else if (this.strategy === Strategy.Attack) {
            this.specifyTargetsAttack();
        } else {
            this.specifyTargetsMaintain();
        }

        for (s = 0; s < this.spawnerAnalysis.length; s += 1) {
            this.spawnerAnalysis[s].unitsToSend =
                globalMyUnitCount * this.spawnerAnalysis[s].priority / this.prioritySum;

            if (DEBUG) {
                console.log("AI", this.faction, "priority for spawner", s,
                            "is", this.spawnerAnalysis[s].priority,
                            "- unitsToSend", this.spawnerAnalysis[s].unitsToSend,
                            "- prioritySum", this.prioritySum);
            }
        }

    };

    // DEFEND at all costs!
    _ComputerAi.specifyTargetsDefend = function () {
        var s, sa, fullyCaptured, spawner, priority,
            globalMyUnitCount = this.entitySystem.unitCount[this.faction];

        for (s = 0; s < this.spawnerAnalysis.length; s += 1) {
            sa = this.spawnerAnalysis[s];
            spawner = sa.object;
            fullyCaptured = spawner.isFullyCaptured();

            sa.priority = 0;

            // defend attacked flag with almost full force
            if (spawner.capturedByFaction === this.faction &&
                       sa.unitCounts[1] > 0 && sa.unitCounts[0] / sa.unitCounts[1] < 2) {
                sa.priority = 40;

            // defend based on distance from HQ
            } else if (spawner.capturedByFaction === this.faction) {
                sa.priority = s + 1;

            }

            // take the chance for a comeback and attack weakly defended flag
            if (sa.enemyDepth <= (this.spawnerAnalysis.length - 1) / 2 &&
                    sa.unitCounts[1] / globalMyUnitCount < 0.15) {
                sa.priority = this.spawnerAnalysis.length;
            }

            this.prioritySum += sa.priority;
        }
    };

    // MAINTAIN current status!
    _ComputerAi.specifyTargetsMaintain = function () {
        var s, sa, fullyCaptured, isNeutral, spawner, priority,
            neutralBeingAttacked = 0, saED1 = null, saED2 = null,
            globalMyUnitCount = this.entitySystem.unitCount[this.faction];

        for (s = 0; s < this.spawnerAnalysis.length; s += 1) {
            sa = this.spawnerAnalysis[s];
            spawner = sa.object;
            fullyCaptured = spawner.isFullyCaptured();
            isNeutral = !spawner.isFullyCaptured() &&
                (spawner.capturePointStatus / spawner.capturePoints) < 0.333;

            sa.priority = 0;

            if (neutralBeingAttacked < this.maxDesignations) {
                if (isNeutral && spawner.capturedByFaction === 0) {
                    sa.priority = 10;
                    neutralBeingAttacked += 1;
                } else if (!fullyCaptured && spawner.capturedByFaction === this.faction) {
                    sa.priority = 10;
                    neutralBeingAttacked += 1;
                } else if (isNeutral) {
                    sa.priority = 10;
                    neutralBeingAttacked += 1;
                }
            }

            // defend flag that is being attacked
            if (spawner.capturedByFaction === this.faction &&
                    sa.unitCounts[1] > 0 && sa.unitCounts[0] / sa.unitCounts[1] < 2) {
                sa.priority = 30;

            // put enough units to flag to be flexible
            } else if (spawner.capturedByFaction === this.faction) {
                sa.priority = Math.max(sa.priority, s + 1);

            }

            if (sa.enemyDepth === 1) {
                saED1 = sa;
            } else if (sa.enemyDepth === 2) {
                saED2 = sa;
            }

            this.prioritySum += sa.priority;
        }

        // if nothing has to be captured, be a little bit annoying to opponent
        if (neutralBeingAttacked === 0 && this.unitBalance >= 0.99 && saED1 !== null) {
            priority = this.prioritySum / 3;

            // see which target is more attractive
            if (saED2 !== null && saED2.unitCounts[1] < saED1.unitCounts[1] / 1.5) {
                sa = saED2;
            } else {
                sa = saED1;
            }

            // only attack if there is the slightest chance
            if (sa.unitCounts[1] < globalMyUnitCount / 2) {
                sa.priority = priority;
                this.prioritySum += priority;
            }
        }

    };

    // ATTACK!
    _ComputerAi.specifyTargetsAttack = function () {
        var s, sa, fullyCaptured, spawner, priority, isNeutral,
            globalMyUnitCount = this.entitySystem.unitCount[this.faction],
            maxEnemySpawnerDepth = Math.max(1, this.maxDesignations),
            designations = 0;

        for (s = 0; s < this.spawnerAnalysis.length; s += 1) {
            sa = this.spawnerAnalysis[s];
            spawner = sa.object;
            fullyCaptured = spawner.isFullyCaptured();
            isNeutral = !spawner.isFullyCaptured() &&
                (spawner.capturePointStatus / spawner.capturePoints) < 0.333;

            // defend flag that is being attacked
            if (spawner.capturedByFaction === this.faction &&
                    sa.unitCounts[1] > 0 && sa.unitCounts[0] / sa.unitCounts[1] < 2) {
                sa.priority = this.spawnerAnalysis.length * 5;
                designations += 1;

            } else if (designations < this.maxDesignations &&
                       sa.enemyDepth > 0 && sa.enemyDepth <= maxEnemySpawnerDepth &&
                       sa.unitCounts[1] < globalMyUnitCount / 1.5) {
                sa.priority = this.spawnerAnalysis.length * 4;
                designations += 1;

            } else if (!fullyCaptured && spawner.capturedByFaction === this.faction) {
                sa.priority = this.spawnerAnalysis.length * 2;
                designations += 1;

            } else if (designations < this.maxDesignations &&
                       isNeutral && spawner.capturedByFaction !== this.faction) {
                sa.priority = this.spawnerAnalysis.length * 3;
                designations += 1;

            } else if (spawner.capturedByFaction === this.faction) {
                sa.priority = s + 1;

            } else {
                sa.priority = 0;

            }

            this.prioritySum += sa.priority;
        }
    };

    _ComputerAi.sendUnits = function () {
        var u, unit, s, spawnerDistance, sa, unitsToSend, spawner,
            globalMyUnitCount = this.entitySystem.unitCount[this.faction];

        for (u = 0; u < this.entitySystem.units.length; u += 1) {
            unit = this.entitySystem.units[u];

            if (unit.faction === this.faction) {

                for (s = 0; s < this.spawnerAnalysis.length; s += 1) {
                    spawnerDistance = this.spawnerDistances[unit.aiTarget][s];
                    sa = this.spawnerAnalysis[spawnerDistance.index];
                    if (sa.unitsToSend > 0) {
                        spawner = sa.object;

                        if ((unit.madeAutomaticMove && unit.isIdle()) ||
                                unit.aiTarget !== spawnerDistance.index ||
                                unit.idleTime() > 5) {
                            unit.setDestination(spawner.x, spawner.y);
                            unit.madeAutomaticMove = false;
                        }

                        unit.aiTarget = spawnerDistance.index;
                        sa.unitsToSend -= 1;
                        break;
                    }
                }

            }
        }

    };

    _ComputerAi.registerUnit = function (unit, spawner) {
        var s;
        unit.aiTarget = 0;
        for (s = 0; s < this.spawnerAnalysis.length; s += 1) {
            if (spawner === this.spawnerAnalysis[s].object) {
                unit.aiTarget = s;
            }
        }
    };

}(SwarmRTSComputerAi = SwarmRTSComputerAi || {}));
