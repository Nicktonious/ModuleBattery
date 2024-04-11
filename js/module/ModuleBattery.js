let getCoeffs = (a1, b1, a2, b2) => {
    let k = (b2 - a2) / (b1 - a1);
    return ({ 
        k: k,
        b: a2 - k * a1
    });
}
const MIN_PERIOD = 30000;
const MAX_PERIOD = ~~Math.sqrt(Number.MAX_SAFE_INTEGER);
/**
 * @class 
 * Класс системы мониторинга питания аккумулятора
 */
class ClassBattery extends ClassSensor {
    constructor(opts) {
        ClassSensor.call(this, opts);
        this._K = opts.k;                       // кэф делителя напряжения
        this._FullChargeV = opts.fullChargeV;   // напряжение на заряженном аккумуляторе
        this._DischargeV = opts.dischargeV;     // напряжение на разряженном
        // this._MaxADC = opts.maxADC || 1;

        if (typeof this._K !== 'number' ||
            typeof this._FullChargeV !== 'number' ||
            typeof this._DischargeV !== 'number') throw new Error('Not a number in config');

        if (this._FullChargeV <= this._DischargeV) throw new Error('fullChargeV value must be greater than dischargeV');
        
        // аналоговый сигнал -> напряжение | канал [1]
        this._Channels[1].DataRefine.SetTransformFunc(4.2, 0);
        // напряжение -> % заряда | канал [0]
        let charge_coeffs = getCoeffs(this._DischargeV, this._FullChargeV, 0, 100); 
        this._Channels[0].DataRefine.SetTransformFunc(charge_coeffs.k, charge_coeffs.b);
        this._Channels[0].DataRefine.SetLim(0, 100);
        // настройка оповещений о низком заряде
        this._Channels[0].EnableAlarms();
        this._Channels[0].Alarms.SetZones({
            yellow: {           
                low:    20, 
                high:   999, 
                cbLow:  (ch, prev) => { Object.emit('battery-low'); }, 
                cbHigh: (ch, prev) => { } 
            },
            red: {             
                low:    10, 
                high:   9999, 
                cbLow:  (ch, prev) => { Object.emit('battery-critical'); }, 
                cbHigh: (ch, prev) => {}
            },
        });
    }
    Start(chNum, _period) {
        // Комментарий: так как 0-й канал опирается на показания первого, Start() вкл оба канала одновременно
        this._ChStatus[0] = 1;
        this._ChStatus[1] = 1;
        let period = (typeof _period === 'number') ? E.clip(_period, MIN_PERIOD, MAX_PERIOD) : MIN_PERIOD;
        this._Interval = setInterval(() => {
            let adc_val = analogRead(this._Pins[0]);
            this.Ch1_Value = adc_val;
            this.Ch0_Value = this._Channels[1].Value;
        }), _period;
    }
    Stop(_chNum) {
        // Комментарий: так как 0-й канал опирается на показания первого, Stop() выкл оба канала одновременно
        this._ChStatus[0] = 0;
        this._ChStatus[1] = 0;
        clearInterval(this._Interval);             
    }
}
exports = ClassBattery;