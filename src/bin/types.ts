import {Connection as _Connection, ConnectionConfig as connectionConfig, Request as _Request, TediousType, TYPES} from 'tedious';
export {TYPES} from 'tedious';

export type types = typeof TYPES;
export const types = TYPES;

export interface TediousTypes extends TediousType {};

export interface Request extends _Request {};
export class Request extends _Request{};

export interface Connection extends _Connection{};
export class Connection extends _Connection{};

export type PoolConfig = {
    min: number,
    max: number,
    timeout: number
}

export interface ConnectionConfig extends connectionConfig{};

export type ConnectionObject = {
    connection: Connection,
    busy: boolean,
    ready: boolean,
    isTimed: boolean,
    id: number,
    ttl?: number,
}

export const TediousStates = {
    INITIALIZED: 'Initialized',
    CONNECTING: 'Connecting',
    SENT_PRELOGIN: 'SentPrelogin',
    REROUTING: 'ReRouting',
    TRANSIENT_FAILURE_RETRY: 'TRANSIENT_FAILURE_RETRY',
    SENT_TLSSSLNEGOTIATION: 'SentTLSSSLNegotiation',
    SENT_LOGIN7_WITH_STANDARD_LOGIN: 'SentLogin7WithStandardLogin',
    SENT_LOGIN7_WITH_NTLM: 'SentLogin7WithNTLMLogin',
    SENT_LOGIN7_WITH_FEDAUTH: 'SentLogin7Withfedauth',
    LOGGED_IN_SENDING_INITIAL_SQL: 'LoggedInSendingInitialSql',
    LOGGED_IN: 'LoggedIn',
    SENT_CLIENT_REQUEST: 'SentClientRequest',
    SENT_ATTENTION: 'SentAttention',
    FINAL: 'Final'
};

export type params = {
    name: string,
    type: TediousTypes,
    value: any
}