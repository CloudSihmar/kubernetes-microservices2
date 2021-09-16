import { IsDateString, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class ResendUserActivationCommandInput {
    @IsUUID()
    id: string;

    @IsString()
    firstName: string;

    @IsString()
    @IsOptional()
    lastName: string | null;

    @IsEmail()
    email: string;

    @IsString()
    activeKey: string;

    @IsDateString()
    activeExpire: string;
}
