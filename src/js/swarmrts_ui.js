/*** Swarm RTS UI module - (c) mjh.at - v0.2.4 2014-12-27 ***/

var SwarmRTSUtil;
var SwarmRTSGame;
var SwarmRTSUi;

/*jslint devel: true, browser: true, nomen: true*/
(function (module) {
    "use strict";

    var gameSize = [1000, 600],
        ml,
        playModeChosen = 0;

    module.scaleFactor = 1;

    ml = {

        leftIsDown : false,
        selectionIsMade : false,
        lastMousePos : { x : 0, y : 0 },

        selection : null,

        isDrag : function (x, y) {
            return Math.abs(ml.lastMousePos.x - x) > 3 &&
                Math.abs(ml.lastMousePos.y - y) > 3;
        },

        mouseDown : function (event) {
            var x, y;
            if (event.button === 0) {
                ml.selectionIsMade = false;
                ml.selection = null;
                ml.leftIsDown = true;
                x = event.pageX - this.offsetLeft;
                y = event.pageY - this.offsetTop;
                setTimeout(function () { ml.checkMouseDown(x, y, 0); }, 150);
            }
        },

        checkMouseDown : function (x, y, count) {
            if (ml.leftIsDown && !ml.isDrag(x, y)) {
                count += 1;
                ml.selectionIsMade = true;
                SwarmRTSGame.setWaypointSelection(
                    x / module.scaleFactor,
                    y / module.scaleFactor,
                    count
                );
                setTimeout(function () { ml.checkMouseDown(x, y, count); }, 50);
            }
        },

        mouseMove : function (event) {
            var currSelection, x1, y1;
            ml.lastMousePos.x = event.pageX - this.offsetLeft;
            ml.lastMousePos.y = event.pageY - this.offsetTop;

            if (ml.leftIsDown && event.button === 0) {
                if (ml.selection === null) {
                    ml.selection = {
                        x : ml.lastMousePos.x,
                        y : ml.lastMousePos.y
                    };
                }

                if (ml.isDrag(ml.selection.x, ml.selection.y)) {
                    ml.selectionIsMade = true;
                    SwarmRTSGame.setSelection(
                        ml.selection.x / module.scaleFactor,
                        ml.selection.y / module.scaleFactor,
                        ml.lastMousePos.x / module.scaleFactor,
                        ml.lastMousePos.y / module.scaleFactor
                    );
                }
            }
        },

        mouseUp : function (event) {
            if (event.button === 0) {
                ml.leftIsDown = false;
            }
        },

        mouseClick : function (event) {
            var gfxx = (event.pageX - this.offsetLeft) / module.scaleFactor,
                gfxy = (event.pageY - this.offsetTop) / module.scaleFactor;
            if (!ml.selectionIsMade && event.button === 0) {
                ml.selection = null;
                SwarmRTSGame.selectCommand(gfxx, gfxy);
            }
            ml.uiElementClickTrigger(gfxx, gfxy);
            ml.selectionIsMade = false;
        },

        mouseRightClick : function (event) {
            event.preventDefault();
            SwarmRTSGame.setDestinationCommand(
                (event.pageX - this.offsetLeft) / module.scaleFactor,
                (event.pageY - this.offsetTop) / module.scaleFactor
            );
        },

        uiElementClickTrigger : function (x, y) {
            var i, uiElements = module.getUiElements();
            for (i = 0; i < uiElements.length; i += 1) {
                if (SwarmRTSUtil.isPointInRect(x, y, uiElements[i].rect)) {
                    uiElements[i].action();
                }
            }
        }
    };


    module.addEventListeners = function () {

        var canvas = document.getElementById("fgCanvas"),
            helpWindow = document.getElementById("help");

        canvas.addEventListener('mousedown', ml.mouseDown, false);
        canvas.addEventListener('mousemove', ml.mouseMove, false);
        canvas.addEventListener('mouseup', ml.mouseUp, false);
        canvas.addEventListener('mouseout', ml.mouseUp, false);
        canvas.addEventListener('click', ml.mouseClick, false);
        canvas.addEventListener('contextmenu', ml.mouseRightClick, false);

        helpWindow.addEventListener(
            'click',
            function (event) { this.className = "help hidden"; },
            false
        );

        document.getElementsByTagName("body")[0].addEventListener(
            'keypress',
            function (event) {
                var gameState, code = (event.keyCode || event.which);
                if (code === 32) {
                    gameState = SwarmRTSGame.getGameState();
                    if (gameState === 0) {
                        SwarmRTSGame.startGame(0);
                    } else if (gameState === 1) {
                        SwarmRTSGame.pauseGame();
                    }
                }
            },
            false
        );

        window.addEventListener('resize', function () { module.resize(canvas); }, false);
        module.resize(canvas);

    };

    module.setGameSize = function (width, height) {
        gameSize = [width, height];
    };

    module.resize = function (canvas) {

        var scale = { x: 1, y: 1 },
            bgCanvas = document.getElementById("bgCanvas");

        canvas.width = Math.max(window.innerWidth, gameSize[0] / 1.5);
        canvas.height = Math.max(window.innerHeight, gameSize[1] / 1.5);
        bgCanvas.width = Math.max(window.innerWidth, gameSize[0] / 1.5);
        bgCanvas.height = Math.max(window.innerHeight, gameSize[1] / 1.5);

        scale.x = canvas.width / gameSize[0];
        scale.y = canvas.height / gameSize[1];

        module.scaleFactor = Math.min(scale.x, scale.y);

        SwarmRTSGame.setScaleFactor(module.scaleFactor);

    };

    module.getUiElements = function () {
        var result = [];
        if (SwarmRTSGame.getGameState() === 0) {
            result[0] = {
                text : "?",
                rect : {x1 : 30, y1 : gameSize[1] - 60,
                        x2 : 60, y2 : gameSize[1] - 30},
                action : function () { document.getElementById("help").className = "help visible"; },
                colors : ["#FFF", "#444", "#666"]
            };
            if (playModeChosen === 0 || playModeChosen === 1) {
                result.push({
                    text : "Play as Blue",
                    rect : {x1 : gameSize[0] / 2 - 190, y1 : gameSize[1] - 60,
                            x2 : gameSize[0] / 2 - 70, y2 : gameSize[1] - 30},
                    action : function () { playModeChosen = 1; SwarmRTSGame.startGame(1); },
                    colors : ["#FFF", "#03D", "#06F"]
                });
            }
            if (playModeChosen === 0) {
                result.push({
                    text : "CPU vs. CPU",
                    rect : {x1 : gameSize[0] / 2 - 60, y1 : gameSize[1] - 60,
                            x2 : gameSize[0] / 2 + 60, y2 : gameSize[1] - 30},
                    action : function () { SwarmRTSGame.startGame(0); },
                    colors : ["#FFF", "#444", "#666"]
                });
            }
            if (playModeChosen === 0 || playModeChosen === 2) {
                result.push({
                    text : "Play as Red",
                    rect : {x1 : gameSize[0] / 2 + 70, y1 : gameSize[1] - 60,
                            x2 : gameSize[0] / 2 + 190, y2 : gameSize[1] - 30},
                    action : function () { playModeChosen = 2; SwarmRTSGame.startGame(2); },
                    colors : ["#FFF", "#C00", "#F22"]
                });
            }
        } else if (SwarmRTSGame.getGameState() === 1) {
            result[0] = {
                text : "||",
                rect : {x1 : gameSize[0] - 30, y1 : gameSize[1] - 30,
                        x2 : gameSize[0] - 10, y2 : gameSize[1] - 10},
                action : function () { SwarmRTSGame.pauseGame(); },
                colors : ["#FFF", "#444", "#666"]
            };
        }
        return result;
    };


}(SwarmRTSUi = SwarmRTSUi || {}));
