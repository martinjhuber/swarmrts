/*** Swarm RTS Game module - (c) mjh.at - v0.3.1 2014-12-28 ***/

var SwarmRTSUtil;
var SwarmRTSEntities;
var SwarmRTSRenderer;
var SwarmRTSUi;
var SwarmRTSGame;

/*jslint devel: true, browser: true, nomen: true*/
(function (module) {
    "use strict";

    var locationGrid, destinationGrid, entitySystem,
        commandWayPoints = [], commandRects = [], currentSelection = null,
        timestamp, gameLoop, checkGameState, updateGameState, updateFps,
        processCommands, makeMoveCommand, makeMoveCommandWaypoint,
        setupStartState, createSpawner,
        renderer = null, scaleFactor = 1,
        gameState,  // 0 = init, 1 = running, 10x = faction x has won
        lastFps = 1, DEBUG = false;

    module.frameCounter = 0;
    module.time = 0;

    /* Step 1 in game loop: check game state */

    checkGameState = function () {
        var f, factionsWithUnits = 0, lastFactionWithUnits;

        for (f = 1; f <= entitySystem.unitCount.length; f += 1) {
            if (entitySystem.unitCount[f] > 0) {
                factionsWithUnits += 1;
                lastFactionWithUnits = f;
            }
        }

        if (factionsWithUnits <= 1) {
            gameState = 100 + lastFactionWithUnits;
        }
    };

    /* Step 2 in game loop: process player commands/input */

    processCommands = function () {
        var i;

        for (i = 0; i < commandWayPoints.length; i += 1) {
            if (commandWayPoints[i].lastMoveCommandTime + 0.5 < module.time) {
                makeMoveCommandWaypoint(commandWayPoints[i]);
                commandWayPoints[i].lastMoveCommandTime = module.time;
            }
        }

        while (commandRects.length > 0) {
            makeMoveCommand(commandRects[0]);
            commandRects.splice(0, 1);
        }
    };

    /*jslint bitwise: true*/
    makeMoveCommand = function (rect) {
        var s, e, sectors, sector, entity,
            rectCenterX = (rect.x2 + rect.x1) >> 1,
            rectCenterY = (rect.y2 + rect.y1) >> 1,
            diffX, diffY;

        sectors = locationGrid.getSectorsByRect(rect);

        for (s = 0; s < sectors.length; s += 1) {
            sector = sectors[s];
            for (e = 0; e < sector.entities.length; e += 1) {
                entity = sector.entities[e];
                if (entitySystem.computerAis[entity.faction] === null &&
                        SwarmRTSUtil.isPointInRect(entity.x, entity.y, rect)) {
                    diffX = (entity.x - rectCenterX) / 4;
                    diffY = (entity.y - rectCenterY) / 4;
                    entity.setDestination(rect.destX + diffX, rect.destY + diffY);
                }
            }
        }
    };

    makeMoveCommandWaypoint = function (wayPoint) {
        var s, e, sectors, sector, entity;

        sectors = locationGrid.getSectorsInRange(wayPoint.x, wayPoint.y, wayPoint.radius);

        for (s = 0; s < sectors.length; s += 1) {
            sector = sectors[s];
            for (e = 0; e < sector.entities.length; e += 1) {
                entity = sector.entities[e];
                if (entitySystem.computerAis[entity.faction] === null && entity.isIdle() &&
                        SwarmRTSUtil.distance(entity.x, entity.y, wayPoint.x, wayPoint.y) <
                            wayPoint.radius) {
                    entity.setDestination(wayPoint.destX, wayPoint.destY);
                }
            }
        }
    };

    /* Step 3 in game loop: populate update to all entities */

    updateGameState = function (timePassed) {
        var s = 0, e = 0, a, entity;

        while (e < entitySystem.units.length) {
            entity = entitySystem.units[e];

            if (entity.isDestroyed()) {
                entitySystem.removeUnitByIndex(e);
            } else {
                entity.update(timePassed);
                e += 1;
            }
        }

        while (s < entitySystem.spawners.length) {
            entitySystem.spawners[s].update(timePassed);
            s += 1;
        }

        for (a = 0; a < entitySystem.computerAis.length; a += 1) {
            if (entitySystem.computerAis[a] !== null) {
                entitySystem.computerAis[a].update(timePassed);
            }
        }

    };

    /* Main game loop */

    timestamp = function () {
        return (window.performance && window.performance.now ?
                window.performance.now() : Date().now) / 1000;
    };

    gameLoop = function () {
        var now = timestamp(),
            timePassed = Math.min(1, now - module.time);

        window.requestAnimationFrame(gameLoop);

        checkGameState();

        if (gameState === 1) {
            processCommands();
            updateGameState(timePassed);
        }

        renderer.render(timePassed);

        module.frameCounter += 1;
        module.time = now;
    };

    /* FPS counter */

    updateFps = function () {
        lastFps = module.frameCounter;
        module.frameCounter = 0;
    };

    /* Entry point into the game */

    module.start = function () {

        var width = 1200, height = 680, gridSize = 20,
            a;

        gameState = 0;

        // Set up system
        locationGrid = new SwarmRTSUtil.GridSystem(width / gridSize, height / gridSize, gridSize);
        destinationGrid = new SwarmRTSUtil.GridSystem(width / gridSize, height / gridSize, gridSize);
        entitySystem = new SwarmRTSUtil.EntitySystem();
        entitySystem.initComputerAi();

        // Init modules
        SwarmRTSEntities.init(locationGrid, destinationGrid, entitySystem);

        // Init renderer
        renderer = new SwarmRTSRenderer.Renderer(locationGrid, entitySystem);

        // Initialize UI
        SwarmRTSUi.setGameSize(locationGrid.width, locationGrid.height);
        SwarmRTSUi.addEventListeners();

        // Set up game start state
        setupStartState(locationGrid.width, locationGrid.height);

        for (a = 0; a < entitySystem.computerAis.length; a += 1) {
            if (entitySystem.computerAis[a] !== null) {
                entitySystem.computerAis[a].init();
            }
        }

        // Start
        setInterval(updateFps, 1000);

        module.time = timestamp();
        window.requestAnimationFrame(gameLoop);

    };

    /* Game state modification */

    module.startGame = function (humanFaction) {
        if (gameState === 0) {
            entitySystem.computerAis[humanFaction] = null;
            gameState = 1;
        }
    };

    module.pauseGame = function () {
        gameState = 0;
    };

    /* Setup playing field with spawners */

    setupStartState = function (width, height) {
        var i, spawner, x, y, neutralSpawners, s, blocked,
            spawnerMinDistance = 200,
            spawnerMinDistanceFromEdge = 110,
            spawnUnitsPerNeutralSpawner = 400;

        // create between 2 and 6 neutral spawners
        neutralSpawners = Math.floor(Math.random() * 5 + 2);

        // y of first spawner
        y = Math.floor(Math.random() * (height - spawnerMinDistanceFromEdge * 2) +
                       spawnerMinDistanceFromEdge);

        // faction 1 HQ
        createSpawner(true, 1, spawnerMinDistanceFromEdge, y,
                      spawnUnitsPerNeutralSpawner * neutralSpawners);

        // faction 2 HQ
        createSpawner(true, 2, width - spawnerMinDistanceFromEdge, height - y,
                      spawnUnitsPerNeutralSpawner * neutralSpawners);


        // if the number is odd, one spawner must be exactly in the middle
        if (neutralSpawners % 2 === 1) {
            createSpawner(false, 0, width / 2, height / 2, 0);
            neutralSpawners -= 1;
        }

        while (neutralSpawners > 0) {
            x = Math.floor(Math.random() * (width / 2 - spawnerMinDistanceFromEdge) +
                           spawnerMinDistanceFromEdge);
            y = Math.floor(Math.random() * (height - spawnerMinDistanceFromEdge * 2) +
                           spawnerMinDistanceFromEdge);
            blocked = false;

            if (SwarmRTSUtil.distance(x, y, width - x, height - y) < spawnerMinDistance) {
                blocked = true;
            } else {
                for (s = 0; s < entitySystem.spawners.length; s += 1) {
                    if (SwarmRTSUtil.distance(entitySystem.spawners[s].x, entitySystem.spawners[s].y,
                                              x, y) < spawnerMinDistance) {
                        blocked = true;
                        break;
                    }
                }
            }

            if (!blocked) {
                createSpawner(false, 0, x, y, 0);
                createSpawner(false, 0, width - x, height - y, 0);
                neutralSpawners -= 2;
            }
        }

        SwarmRTSUtil.shuffleArray(entitySystem.units);

    };

    createSpawner = function (isHq, faction, x, y, spawnUnits) {
        var spawner = isHq ? new SwarmRTSEntities.SpawnerHQ(faction, x, y) :
                             new SwarmRTSEntities.Spawner(faction, x, y);
        if (spawnUnits > 0) {
            spawner.spawnUnits(spawnUnits, true);
        }
        spawner.init();
        entitySystem.registerEntity(spawner);
    };

    /* Mouse command processing */

    module.setSelection = function (selRect1x, selRect1y, selRect2x, selRect2y) {
        currentSelection = {
            type : "rectangle",
            x1 : Math.max(0, Math.min(selRect1x, selRect2x)),
            y1 : Math.max(0, Math.min(selRect1y, selRect2y)),
            x2 : Math.min(locationGrid.width - 1, Math.max(selRect1x, selRect2x)),
            y2 : Math.min(locationGrid.height - 1, Math.max(selRect1y, selRect2y)),
            radius : 0
        };
    };

    module.setWaypointSelection = function (x, y, duration) {
        currentSelection = {
            type : "waypoint",
            x1 : Math.max(0, Math.min(locationGrid.width - 1, x)),
            y1 : Math.max(0, Math.min(locationGrid.height - 1, y)),
            x2 : 0,
            y2 : 0,
            radius : duration * 4.5
        };
    };

    // left click
    module.selectCommand = function (x, y) {
        currentSelection = null;

        if (DEBUG) {
            var i, sector = locationGrid.getSectorByCoordSafe(x, y);
            if (sector !== null) {
                for (i = 0; i < sector.entities.length; i += 1) {
                    if (SwarmRTSUtil.distance(sector.entities[i].x, sector.entities[i].y, x, y) <=
                            sector.entities[i].size / 2) {
                        console.log("DEBUG Entity:", sector.entities[i]);
                    }
                }
            }
        }

    };

    // "right click"
    module.setDestinationCommand = function (destX, destY) {
        var i, w;
        if (currentSelection !== null) {
            if (currentSelection.type === "rectangle") {
                commandRects.push({
                    x1 : currentSelection.x1,
                    y1 : currentSelection.y1,
                    x2 : currentSelection.x2,
                    y2 : currentSelection.y2,
                    destX : destX,
                    destY : destY
                });
            } else {
                commandWayPoints.push({
                    x : currentSelection.x1,
                    y : currentSelection.y1,
                    radius : currentSelection.radius,
                    destX : destX,
                    destY : destY,
                    lastMoveCommandTime : module.time
                });
                currentSelection = null;
            }
        } else {
            for (i = 0; i < commandWayPoints.length; i += 1) {
                if (SwarmRTSUtil.distance(destX, destY, commandWayPoints[i].x, commandWayPoints[i].y) <
                        commandWayPoints[i].radius) {
                    commandWayPoints.splice(i, 1);
                    break;
                }
            }
        }
    };

    /* UI actions */

    module.setScaleFactor = function (factor) {
        renderer.setScaleFactor(factor);
    };

    /* Retrieval methods used by other modules */

    module.getGameState = function () {
        return gameState;
    };

    module.getCurrentSelection = function () {
        return currentSelection;
    };

    module.getCommandWayPoints = function () {
        return commandWayPoints;
    };

    module.getCommandRects = function () {
        return commandRects;
    };

    module.getFps = function () {
        return lastFps;
    };

}(SwarmRTSGame = SwarmRTSGame || {}));
