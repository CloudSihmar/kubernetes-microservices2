import { ManagerStatus } from 'domain/enums/ManagerStatus';
import { User } from './User';

export class Manager extends User {
    email: string;
    status: ManagerStatus;
    archivedAt?: Date;

    /* Relationship */

    /* Handlers */
}
