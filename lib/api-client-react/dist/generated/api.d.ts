import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { CreateJobRequest, ErrorResponse, HealthStatus, JobStatus } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * Returns server health status
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * Submits a URL to begin link discovery and screenshotting
 * @summary Start a screenshot job
 */
export declare const getCreateJobUrl: () => string;
export declare const createJob: (createJobRequest: CreateJobRequest, options?: RequestInit) => Promise<JobStatus>;
export declare const getCreateJobMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createJob>>, TError, {
        data: BodyType<CreateJobRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createJob>>, TError, {
    data: BodyType<CreateJobRequest>;
}, TContext>;
export type CreateJobMutationResult = NonNullable<Awaited<ReturnType<typeof createJob>>>;
export type CreateJobMutationBody = BodyType<CreateJobRequest>;
export type CreateJobMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Start a screenshot job
 */
export declare const useCreateJob: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createJob>>, TError, {
        data: BodyType<CreateJobRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createJob>>, TError, {
    data: BodyType<CreateJobRequest>;
}, TContext>;
/**
 * Returns current status and progress log for a job
 * @summary Get job status
 */
export declare const getGetJobUrl: (jobId: string) => string;
export declare const getJob: (jobId: string, options?: RequestInit) => Promise<JobStatus>;
export declare const getGetJobQueryKey: (jobId: string) => readonly [`/api/jobs/${string}`];
export declare const getGetJobQueryOptions: <TData = Awaited<ReturnType<typeof getJob>>, TError = ErrorType<ErrorResponse>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetJobQueryResult = NonNullable<Awaited<ReturnType<typeof getJob>>>;
export type GetJobQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get job status
 */
export declare function useGetJob<TData = Awaited<ReturnType<typeof getJob>>, TError = ErrorType<ErrorResponse>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Cancel a running job
 */
export declare const getCancelJobUrl: (jobId: string) => string;
export declare const cancelJob: (jobId: string, options?: RequestInit) => Promise<JobStatus>;
export declare const getCancelJobMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof cancelJob>>, TError, {
        jobId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof cancelJob>>, TError, {
    jobId: string;
}, TContext>;
export type CancelJobMutationResult = NonNullable<Awaited<ReturnType<typeof cancelJob>>>;
export type CancelJobMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Cancel a running job
 */
export declare const useCancelJob: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof cancelJob>>, TError, {
        jobId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof cancelJob>>, TError, {
    jobId: string;
}, TContext>;
/**
 * @summary Download ZIP file for a completed job
 */
export declare const getDownloadJobUrl: (jobId: string) => string;
export declare const downloadJob: (jobId: string, options?: RequestInit) => Promise<Blob>;
export declare const getDownloadJobQueryKey: (jobId: string) => readonly [`/api/jobs/${string}/download`];
export declare const getDownloadJobQueryOptions: <TData = Awaited<ReturnType<typeof downloadJob>>, TError = ErrorType<ErrorResponse>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof downloadJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof downloadJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type DownloadJobQueryResult = NonNullable<Awaited<ReturnType<typeof downloadJob>>>;
export type DownloadJobQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Download ZIP file for a completed job
 */
export declare function useDownloadJob<TData = Awaited<ReturnType<typeof downloadJob>>, TError = ErrorType<ErrorResponse>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof downloadJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map