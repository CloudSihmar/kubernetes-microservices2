import { Client } from '@domain/entities/user/Client';
import { ClientStatus } from '@domain/enums/user/ClientStatus';
import { RoleId } from '@domain/enums/user/RoleId';
import { IClientRepository } from '@gateways/repositories/user/IClientRepository';
import { IAuthenticationService } from '@gateways/services/IAuthenticationService';
import { IDbContext } from '@shared/database/interfaces/IDbContext';
import { MessageError } from '@shared/exceptions/message/MessageError';
import { SystemError } from '@shared/exceptions/SystemError';
import { IQueueContext } from '@shared/queue/interfaces/IQueueContext';
import { UserExchange } from '@shared/queue/provide/exchanges/UserExchange';
import { IAuthCreateUserPayload } from '@shared/queue/provide/payloads/auth/IAuthCreateUserPayload';
import { IChatCreateUserPayload } from '@shared/queue/provide/payloads/chat/IChatCreateUserPayload';
import { CommandHandler } from '@shared/usecase/CommandHandler';
import { HandleOption } from '@shared/usecase/HandleOption';
import { CheckEmailExistQueryHandler } from '@usecases/user/user/queries/check-email-exist/CheckEmailExistQueryHandler';
import { validateDataInput } from '@utils/validator';
import { Inject, Service } from 'typedi';
import { CreateClientCommandInput } from './CreateClientCommandInput';
import { CreateClientCommandOutput } from './CreateClientCommandOutput';

@Service()
export class CreateClientCommandHandler extends CommandHandler<CreateClientCommandInput, CreateClientCommandOutput> {
    @Inject()
    private readonly _checkEmailExistQueryHandler: CheckEmailExistQueryHandler;

    @Inject('db.context')
    private readonly _dbContext: IDbContext;

    @Inject('queue.context')
    private readonly _queueContext: IQueueContext;

    @Inject('authentication.service')
    private readonly _authenticationService: IAuthenticationService;

    @Inject('client.repository')
    private readonly _clientRepository: IClientRepository;

    async handle(param: CreateClientCommandInput, handleOption: HandleOption): Promise<CreateClientCommandOutput> {
        await validateDataInput(param);

        const data = new Client();
        data.roleId = RoleId.Client;
        data.status = ClientStatus.Actived;
        data.firstName = param.firstName;
        data.lastName = param.lastName;
        data.email = param.email;
        data.gender = param.gender;
        data.birthday = param.birthday;
        data.phone = param.phone;
        data.address = param.address;
        data.locale = param.locale;

        const checkEmailResult = await this._checkEmailExistQueryHandler.handle(data.email);
        if (checkEmailResult.data)
            throw new SystemError(MessageError.PARAM_EXISTED, 'email');

        return await this._dbContext.getConnection().runTransaction(async queryRunner => {
            const id = await this._clientRepository.create(data, queryRunner);
            const hasSucceed = await this._authenticationService.createUserAuth({
                userId: id,
                email: data.email,
                password: param.password
            }, handleOption);

            if (!hasSucceed)
                throw new SystemError(MessageError.DATA_CANNOT_SAVE);

            const userPayload: IAuthCreateUserPayload | IChatCreateUserPayload = {
                id,
                roleId: data.roleId,
                status: data.status,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email
            };
            this._queueContext.publish(UserExchange.EXCHANGE, UserExchange.KEYS.USER_EVENT_CREATED, userPayload, {}, handleOption);

            const result = new CreateClientCommandOutput();
            result.setData(id);
            return result;
        });
    }
}
