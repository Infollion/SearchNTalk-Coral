import BaseModel                                                = require('../models/BaseModel');
import MoneyUnit                                                = require('../enums/MoneyUnit');

class PricingScheme extends BaseModel
{
    static TABLE_NAME:string                                    = 'pricing_scheme';

    static COL_USER_ID:string                                   = 'user_id';
    static COL_CHARGING_RATE:string                             = 'charging_rate';
    static COL_UNIT:string                                      = 'unit';
    static COL_PULSE_RATE:string                                = 'pulse_rate';
    static COL_MIN_DURATION:string                              = 'min_duration';

    static PUBLIC_FIELDS:string[] = [PricingScheme.COL_ID, PricingScheme.COL_USER_ID, PricingScheme.COL_CHARGING_RATE, PricingScheme.COL_UNIT, PricingScheme.COL_PULSE_RATE, PricingScheme.COL_MIN_DURATION];

    private user_id:number;
    private charging_rate:number;
    private unit:MoneyUnit;
    private pulse_rate:number;                                  // Sizes of chargeable time chunks
    private min_duration:number;                                // Min duration for the call

    /* Getters */
    getUserId():number                                          { return this.user_id; }
    getChargingRate():number                                    { return this.charging_rate; }
    getUnit():MoneyUnit                                         { return this.unit; }
    getPulseRate():number                                       { return this.pulse_rate; }
    getMinDuration():number                                     { return this.min_duration; }

    /* Setters */
    setUserId(val:number)                                       { this.user_id = val; }
    setChargingRate(val:number)                                 { this.charging_rate = val; }
    setUnit(val:MoneyUnit)                                      { this.unit = val; }
    setPulseRate(val:number)                                    { this.pulse_rate = val; }
    setMinDuration(val:number)                                  { this.min_duration = val; }
}
export = PricingScheme