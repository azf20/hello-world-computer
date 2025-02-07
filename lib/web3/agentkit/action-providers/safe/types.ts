type CreateSafeReturnType = {
    safeAddress: string;
    transactionHash: string;
    threshold: number;
    owners: string[]
} | {
    error: Error;
};

type CreateSafeTransactionReturnType = {
    transactionHash: string;
    signatureCount: number;
} | {
    error: Error;
};

type SignSafeTransactionReturnType = {
    transactionHash: string;
    signatureCount: number;
} | {
    error: Error;
};

type ExecuteSafeTransactionReturnType = {
    transactionHash: string;
} | {
    error: Error;
};
