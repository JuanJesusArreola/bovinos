import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import Location from './Location';

//Modelo que se utilizara en caso de que los bovinos ceunten con gps y se registre de manera automatica el cambio
class BovineTracking extends Model {
    public bovineId?: string;
    public latitude?: number;
    public longitude?: number;
    public recordedAt?: Date;
    public source: 'GPS' | 'MANUAL' | 'IMPORTED';
    public accuracy?: number;
}