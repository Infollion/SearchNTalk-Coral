///<reference path='../_references.d.ts'/>
import q                                        = require('q');
import AbstractDao                              = require('./AbstractDao');
import BaseModel                                = require('../models/BaseModel');
import PhoneCall                                = require('../models/PhoneCall');

/*
 DAO for phone calls
 */
class PhoneCallDao extends AbstractDao
{
    constructor() { super(PhoneCall); }
}
export = PhoneCallDao