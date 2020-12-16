/*** Swarm RTS Effects module - (c) mjh.at - v0.3.0 2014-12-28 ***/

var SwarmRTSEffects;

/*jslint devel: true, browser: true, nomen: true*/
(function (module) {
    "use strict";

    var _EffectSystem, _Effect, _Explosion;

    module.EffectSystem = function () {
        this.effects = [];
    };
    _EffectSystem = module.EffectSystem.prototype;

    _EffectSystem.registerEffect = function (effect) {
        if (this.effects.length < 1000) {
            this.effects.push(effect);
        }
    };

    _EffectSystem.update = function (canvasContext, timePassed) {
        var i = 0, effect;

        while (i < this.effects.length) {
            effect = this.effects[i];
            effect.update(canvasContext, timePassed);

            if (effect.isDone()) {
                this.effects.splice(i, 1);
            } else {
                i += 1;
            }
        }
    };

    module.effectSystem = new module.EffectSystem();


    /*** EFFECT ***/
    module.Effect = function (duration) {
        this.time = 0;
        this.duration = duration;
    };
    _Effect = module.Effect.prototype;

    _Effect.update = function (canvasContext, timePassed) {
        this.time += timePassed;
    };

    _Effect.isDone = function () {
        return this.time >= this.duration;
    };


    /*** EXPOSION EFFECT ***/
    module.Explosion = function (duration, x, y, startSize, finalSize) {
        module.Effect.call(this, duration);

        this.x = x;
        this.y = y;
        this.startSize = startSize;
        this.finalSize = finalSize;

        this.startRgb = [255, 255, 100];
        this.endRgb = [255, 80, 0];

    };
    module.Explosion.prototype = Object.create(_Effect);
    _Explosion = module.Explosion.prototype;
    _Explosion.parentUpdate = _Effect.update;

    _Explosion.update = function (canvasContext, timePassed) {
        var r, g, b, size, factor;

        factor = this.time / this.duration;
        r = Math.floor(this.startRgb[0] + (this.endRgb[0] - this.startRgb[0]) * factor);
        g = Math.floor(this.startRgb[1] + (this.endRgb[1] - this.startRgb[1]) * factor);
        b = Math.floor(this.startRgb[2] + (this.endRgb[2] - this.startRgb[2]) * factor);
        size = this.startSize + (this.finalSize - this.startSize) * factor;

        canvasContext.fillStyle = "rgba(" + r + "," + g + "," + b + ",1.0)";
        canvasContext.beginPath();
        canvasContext.arc(this.x, this.y, size, 0, Math.PI * 2);
        canvasContext.closePath();
        canvasContext.fill();

        this.parentUpdate(canvasContext, timePassed);
    };


}(SwarmRTSEffects = SwarmRTSEffects || {}));
