/*** Swarm RTS Renderer module - (c) mjh.at - v0.3.2 2014-12-28 ***/

var SwarmRTSUtil;
var SwarmRTSEffects;
var SwarmRTSGame;
var SwarmRTSUi;
var SwarmRTSRenderer;

/*jslint devel: true, browser: true, nomen: true*/
(function (module) {
    "use strict";

    var DEBUG = false,
        _Renderer;

    module.Renderer = function (gridSystem, entitySystem) {
        var i;

        this.gridSystem = gridSystem;
        this.entitySystem = entitySystem;

        this.factionNames = ["n/a", "Blue", "Red"];
        this.unitFactionColors = ["#FFF", "#06F", "#F00"];
        this.unitAttackColors = ["#FFF", "#0F0", "#FF0"];

        this.canvas = document.getElementById("fgCanvas");
        this.context = this.canvas.getContext("2d");
        this.bgCanvas = document.getElementById("bgCanvas");
        this.bgContext = this.bgCanvas.getContext("2d");

        this.backgroundStars = [];
        for (i = 0; i < 500; i += 1) {
            this.backgroundStars.push([
                Math.floor(Math.random() * gridSystem.width),
                Math.floor(Math.random() * gridSystem.height),
                Math.floor(Math.random() * 100 + 50)
            ]);
        }

    };
    _Renderer = module.Renderer.prototype;

    _Renderer.render = function (timePassed) {

        this.renderBackground(timePassed);
        this.showFps(SwarmRTSGame.getFps());

        this.context.clearRect(0, 0, this.gridSystem.width, this.gridSystem.height);

        this.renderEntities();

        if (DEBUG) {
            this.renderSectors();
        }

        SwarmRTSEffects.effectSystem.update(this.context, timePassed);

        this.renderCommands();
        this.renderUi();
        this.renderGameState();
        this.renderBorder();

    };

    _Renderer.setScaleFactor = function (factor) {
        this.context.scale(factor, factor);
        this.bgContext.scale(factor, factor);
    };

    _Renderer.renderBackground = function (timePassed) {
        var i, bs, spawner;

        this.bgContext.fillStyle = "#191919";
        this.bgContext.fillRect(0, 0, this.gridSystem.width, this.gridSystem.height);

        for (i = 0; i < this.backgroundStars.length; i += 1) {
            bs = this.backgroundStars[i];

            bs[0] += timePassed * bs[2] / 20;

            if (bs[0] > this.gridSystem.width) {
                bs[0] = 0;
            }

            this.bgContext.fillStyle = "rgb(" + bs[2] + "," + bs[2] + "," + bs[2] + ")";
            this.bgContext.fillRect(bs[0], bs[1], 1, 1);
        }

        this.bgContext.save();
        this.bgContext.globalAlpha = 0.07;
        for (i = 0; i < this.entitySystem.spawners.length; i += 1) {
            spawner = this.entitySystem.spawners[i];
            this.bgContext.beginPath();
            this.bgContext.fillStyle = spawner.isFullyCaptured() ?
                    this.unitFactionColors[spawner.capturedByFaction] : "#666";
            this.bgContext.arc(spawner.x, spawner.y, spawner.captureRadius, 0, Math.PI * 2);
            this.bgContext.closePath();
            this.bgContext.fill();
        }
        this.bgContext.restore();
    };

    _Renderer.renderEntities = function () {
        var i, entity;

        this.context.lineWidth = 2;

        this.context.strokeStyle = this.unitAttackColors[1];
        this.context.fillStyle = this.unitFactionColors[1];
        for (i = 0; i < this.entitySystem.units.length; i += 1) {
            if (this.entitySystem.units[i].faction === 1) {
                entity = this.entitySystem.units[i];
                if (entity.type === 1) {
                    this.renderFighter(entity);
                } else {
                    this.renderDestroyer(entity);
                }
            }
        }

        this.context.strokeStyle = this.unitAttackColors[2];
        this.context.fillStyle = this.unitFactionColors[2];
        for (i = 0; i < this.entitySystem.units.length; i += 1) {
            if (this.entitySystem.units[i].faction === 2) {
                entity = this.entitySystem.units[i];
                if (entity.type === 1) {
                    this.renderFighter(entity);
                } else {
                    this.renderDestroyer(entity);
                }
            }
        }

        for (i = 0; i < this.entitySystem.spawners.length; i += 1) {
            this.renderSpawner(this.entitySystem.spawners[i]);
        }
    };

    _Renderer.renderSectors = function () {
        var sx, sy, sector;

        for (sx = 0; sx < this.gridSystem.sectors.length; sx += 1) {
            for (sy = 0; sy < this.gridSystem.sectors[sx].length; sy += 1) {
                sector = this.gridSystem.sectors[sx][sy];

                if (DEBUG) {
                    this.context.strokeStyle = "#0F0";
                    this.context.lineWidth = 0.15;
                    this.context.strokeRect(
                        sector.sx * this.gridSystem.gridSize,
                        sector.sy * this.gridSystem.gridSize,
                        this.gridSystem.gridSize,
                        this.gridSystem.gridSize
                    );
                    this.context.font = "normal 7px 'Lucida Console'";
                    this.context.textAlign = "left";
                    this.context.fillStyle = "#0F0";
                    this.context.fillText(
                        sector.entities.length,
                        sector.sx * this.gridSystem.gridSize,
                        sector.sy * this.gridSystem.gridSize + 7
                    );
                }

            }
        }

    };

    /*jslint bitwise: true*/
    _Renderer.renderFighter = function (entity) {

        //this.context.fillStyle = this.unitFactionColors[entity.faction];
        this.context.fillRect(
            entity.x - (entity.size >> 1),
            entity.y - (entity.size >> 1),
            entity.size,
            entity.size
        );

        if (entity.shootsTill > entity.time) {
            this.defaultAttack(
                entity.x,
                entity.y,
                entity.target.x,
                entity.target.y
            );
        }
    };

    /*jslint bitwise: true*/
    _Renderer.renderDestroyer = function (entity) {
        var p1 = [0, 3], p2 = [-2, -2], p3 = [2, -2],
            p1x, p1y, p2x, p2y, p3x, p3y;

        p1x = -Math.sin(entity.angle) * (4) + entity.x;
        p2x = Math.cos(entity.angle) * (-3) - Math.sin(entity.angle) * (-3) + entity.x;
        p3x = Math.cos(entity.angle) * (3) - Math.sin(entity.angle) * (-3) + entity.x;
        p1y = Math.cos(entity.angle) * (3) + entity.y;
        p2y = Math.sin(entity.angle) * (-3) + Math.cos(entity.angle) * (-3) + entity.y;
        p3y = Math.sin(entity.angle) * (3) + Math.cos(entity.angle) * (-3) + entity.y;

        this.context.beginPath();
        this.context.moveTo(p1x, p1y);
        this.context.lineTo(p2x, p2y);
        this.context.lineTo(p3x, p3y);
        //this.context.lineTo(p1x, p1y);
        this.context.closePath();

        //this.context.fillStyle = this.unitFactionColors[entity.faction];
        this.context.fill();

        if (entity.shootsTill > entity.time) {
            this.defaultAttack(
                entity.x,
                entity.y,
                entity.target.x,
                entity.target.y
            );
        }
    };

    _Renderer.renderSpawner = function (spawner) {
        var halfSize;

        this.context.save();
        this.context.beginPath();
        this.context.strokeStyle = "rgba(0,0,0,0.6)";
        this.context.lineWidth = 3;
        this.context.fillStyle = this.unitFactionColors[spawner.capturedByFaction];
        if (spawner.type === 10) {
            this.context.arc(spawner.x, spawner.y, (spawner.size >> 1), 0, Math.PI * 2);
        } else {
            halfSize = (spawner.size >> 1) + 1;
            this.context.moveTo(spawner.x + halfSize, spawner.y);
            this.context.lineTo(spawner.x + halfSize / 2, spawner.y - halfSize * 0.866);
            this.context.lineTo(spawner.x - halfSize / 2, spawner.y - halfSize * 0.866);
            this.context.lineTo(spawner.x - halfSize, spawner.y);
            this.context.lineTo(spawner.x - halfSize / 2, spawner.y + halfSize * 0.866);
            this.context.lineTo(spawner.x + halfSize / 2, spawner.y + halfSize * 0.866);
            //this.context.rect(spawner.x - spawner.size / 2, spawner.y - spawner.size / 2,
            //                  spawner.size, spawner.size);
        }
        this.context.closePath();
        this.context.fill();
        this.context.stroke();
        this.context.restore();

        this.context.save();
        this.context.fillStyle = "rgba(0,0,0,0.6)";
        this.context.fillRect(spawner.x - 16, spawner.y + spawner.size - 2, 32, 13);
        this.context.restore();

        this.context.font = "normal 10px Verdana";
        this.context.textAlign = "center";
        this.context.fillStyle = this.unitFactionColors[spawner.capturedByFaction];
        this.context.fillText(
            " " + Math.floor(spawner.capturePointStatus / spawner.capturePoints * 100) + "% ",
            spawner.x,
            spawner.y + spawner.size + 8
        );

        this.context.beginPath();
        this.context.strokeStyle = "#CCC";
        this.context.lineWidth = 1.5;
        this.context.moveTo(spawner.x, spawner.y);
        this.context.lineTo(spawner.x, spawner.y - spawner.size - 1);
        this.context.closePath();
        this.context.stroke();

        this.context.beginPath();
        this.context.strokeStyle = this.unitFactionColors[spawner.capturedByFaction];
        this.context.lineWidth = 4;
        this.context.moveTo(spawner.x, spawner.y - spawner.size + 1.5);
        this.context.lineTo(spawner.x + 6, spawner.y - spawner.size + 1.5);
        this.context.closePath();
        this.context.stroke();

    };

    _Renderer.defaultAttack = function (fromX, fromY, toX, toY) {
        this.context.beginPath();
        this.context.moveTo(fromX, fromY);
        this.context.lineTo(toX + (Math.random() * 2 - 1), toY + (Math.random() * 2 - 1));
        this.context.lineWidth = 0.5;
        this.context.stroke();
    };

    _Renderer.renderCommands = function () {
        var currSelection = SwarmRTSGame.getCurrentSelection();

        this.context.lineWidth = 0.5;
        this.context.strokeStyle = "#0FD";

        this.renderWayPoints();
        this.renderCommandRects();

        this.context.strokeStyle = "#0F0";

        if (currSelection !== null) {
            this.renderSelectionBox(currSelection);
        }
    };

    _Renderer.renderWayPoints = function () {
        var i, wayPoint, startX, startY, dist,
            wayPoints = SwarmRTSGame.getCommandWayPoints();

        for (i = 0; i < wayPoints.length; i += 1) {
            wayPoint = wayPoints[i];
            dist = SwarmRTSUtil.distance(wayPoint.x, wayPoint.y, wayPoint.destX, wayPoint.destY);
            startX = wayPoint.x + (wayPoint.destX - wayPoint.x) * wayPoint.radius / dist;
            startY = wayPoint.y + (wayPoint.destY - wayPoint.y) * wayPoint.radius / dist;
            this.renderWayPoint(wayPoint, startX, startY);
        }
    };

    _Renderer.renderWayPoint = function (wayPoint, lineStartX, lineStartY) {
        this.context.beginPath();
        this.context.arc(wayPoint.x, wayPoint.y, wayPoint.radius, 0, Math.PI * 2);
        this.context.moveTo(lineStartX, lineStartY);
        this.context.lineTo(wayPoint.destX, wayPoint.destY);
        this.context.stroke();
    };

    _Renderer.renderCommandRects = function () {
        var i, rect, centerX, centerY, k, diffLineX, diffLineY,
            commandRects = SwarmRTSGame.getCommandRects();

        for (i = 0; i < commandRects.length; i += 1) {
            rect = commandRects[i];
            centerX = (rect.x2 + rect.x1) / 2;
            centerY = (rect.y2 + rect.y1) / 2;
            k = (rect.destY - centerY) / (rect.destX - centerX);
            diffLineX = Math.min((rect.x2 - rect.x1) / 2, Math.abs(((rect.y2 - rect.y1) / 2) / k));
            diffLineY = Math.min((rect.y2 - rect.y1) / 2, Math.abs(k * ((rect.x2 - rect.x1) / 2)));
            this.renderCommandRect(
                rect,
                centerX + diffLineX * (rect.destX < centerX ? -1 : 1),
                centerY + diffLineY * (rect.destY < centerY ? -1 : 1)
            );
        }
    };

    _Renderer.renderCommandRect = function (rect, lineStartX, lineStartY) {
        this.context.beginPath();
        this.context.rect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
        this.context.moveTo(lineStartX, lineStartY);
        this.context.lineTo(rect.destX, rect.destY);
        this.context.stroke();
    };


    _Renderer.renderSelectionBox = function (sel) {
        this.context.beginPath();
        if (sel.type === "rectangle") {
            this.context.rect(sel.x1, sel.y1, sel.x2 - sel.x1, sel.y2 - sel.y1);
        } else {
            this.context.arc(sel.x1, sel.y1, sel.radius, 0, Math.PI * 2);
        }
        this.context.stroke();
    };

    _Renderer.showFps = function (fps) {
        this.bgContext.font = "normal 9px 'Lucida Console'";
        this.bgContext.textAlign = "right";
        this.bgContext.fillStyle = "#0F0";
        this.bgContext.fillText(" " + fps, this.gridSystem.width - 2, 10);
    };

    _Renderer.renderUi = function () {
        var i, uiElements = SwarmRTSUi.getUiElements(), left = 100, width = 200;

        this.context.save();
        this.context.fillStyle = "rgba(0,0,0,0.6)";
        this.context.fillRect(this.gridSystem.width / 2 - left, this.gridSystem.height - 22,
                              width, 15);
        this.context.restore();

        this.context.font = "normal 12px Verdana";
        this.context.fillStyle = "#FFF";
        this.context.textAlign = "center";
        this.context.fillText("Units", this.gridSystem.width / 2, this.gridSystem.height - 10);

        this.context.font = "bold 12px Verdana";
        for (i = 1; i < this.entitySystem.unitCount.length; i += 1) {
            this.context.fillStyle = this.unitFactionColors[i];
            this.context.textAlign = i % 2 === 1 ? "right" : "left";
            this.context.fillText(
                this.entitySystem.unitCount[i],
                this.gridSystem.width / 2 + Math.pow(-1, i) * 50,
                this.gridSystem.height - 10
            );
        }


        for (i = 0; i < uiElements.length; i += 1) {

            this.context.fillStyle = uiElements[i].colors[1];
            this.context.strokeStyle = uiElements[i].colors[2];
            this.context.lineWidth = 2;
            this.context.beginPath();
            this.context.rect(
                uiElements[i].rect.x1,
                uiElements[i].rect.y1,
                uiElements[i].rect.x2 - uiElements[i].rect.x1,
                uiElements[i].rect.y2 - uiElements[i].rect.y1
            );
            this.context.fill();
            this.context.stroke();
            this.context.fillStyle = uiElements[i].colors[0];
            this.context.font = "normal 14px Verdana";
            this.context.textAlign = "center";
            this.context.fillText(
                uiElements[i].text,
                uiElements[i].rect.x1 + (uiElements[i].rect.x2 - uiElements[i].rect.x1) / 2,
                uiElements[i].rect.y1 + (uiElements[i].rect.y2 - uiElements[i].rect.y1) / 2 + 5
            );
        }
    };

    _Renderer.renderGameState = function () {
        var faction, gameState = SwarmRTSGame.getGameState();

        if (gameState >= 100) {
            faction = gameState - 100;

            this.context.save();
            this.context.font = "normal 40px Verdana";
            this.context.textAlign = "center";
            this.context.fillStyle = this.unitFactionColors[faction];
            this.context.shadowOffsetX = 3;
            this.context.shadowOffsetY = 3;
            this.context.shadowColor = "#000";

            if (faction === 0) {
                this.context.fillText("Wow, the game has ended in a draw!",
                                      this.gridSystem.width / 2, this.gridSystem.height / 2 + 10);
            } else {
                this.context.fillText("Faction " + this.factionNames[faction] + " has won!",
                                      this.gridSystem.width / 2, this.gridSystem.height / 2 + 10);
            }
            this.context.restore();

        }

    };

    _Renderer.renderBorder = function () {

        this.context.fillStyle = "#000";
        this.context.fillRect(this.gridSystem.width, 0, 500, this.gridSystem.height + 500);
        this.context.fillRect(0, this.gridSystem.height, this.gridSystem.width + 500, 500);

    };

}(SwarmRTSRenderer = SwarmRTSRenderer || {}));
