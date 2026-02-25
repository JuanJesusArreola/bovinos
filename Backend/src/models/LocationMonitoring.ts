import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import Location from './Location';

class LocationMonitoring extends Model {

    locationId: string;      // FK a Location

    public isMonitored!: boolean;
    public monitoringMode: 'MANUAL' | 'AUTOMATED' | 'HYBRID';
    public hasAlerts!: boolean;
    public lastAlertDate?: Date;
    alertCount: number;
    lastAlertType?: string;

    lastPingAt?: Date;
    deviceId?: string;
    deviceBattery?: number;
    signalStrength?: number;

    lastUpdated: Date;
    updatedBy: string;
    
}