import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import Location from './Location';

class LocationInfo extends Model {
 
  public locationId!: string;
 
  description?: string;
  currentCondition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  currentNotes?: string;

  public notes: string;
  public tags: string;
  public images?: string[];
  public documents?: string[];
  public videos?: string[];
  public maps?: string[];

  lastInspectionDate?: Date;
  nextInspectionDate?: Date;
  inspectionNotes?: string;
  inspectedBy?: string;
  
  lastReviewedAt?: Date;
  reviewedBy?: string;
  lastUpdated: Date;
  updatedBy: string;
}


export default LocationInfo;
