import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import Location from './Location';
import Bovine from './Bovine';

class BovineLocationHistory extends Model {
    public bovineId: string;
    public locationId: string;
    public enteredAt: Date;
    public exitedAt: Date;
    public reason: 'GRAZING' | 'MEDICAL' | 'QUARANTINE' |'BREEDING' | 'TRANSFER' | 'SALE';
    public recordedBy: string;
    public movementType: 'MANUAL' | 'AUTOMATED' | 'SCHEDULED';
    public notes?: string;
    public eventId?: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
    public deletedAt?: Date;
}