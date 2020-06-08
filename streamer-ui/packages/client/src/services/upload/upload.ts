import { useState, useEffect, Dispatch } from "react";

import { 
    baseUrl,
    fetchRetry, 
    basicAuthString 
} from "../fetch/fetch";

import {
    UserProfile,
    ServerResponse,
    RcFile,
    BeginResult,
    ValidateFileResult,
    ValidationResult,
    AddFileResult,
    FinalizeResult,
    SubmitResult,
    UploadStatus,
    UploadState,
    UploadAction,
    UploadActionType,
    FilesSelection
} from "../../types/types";

// 1 GB = 1024 * 1024 * 1024 bytes = 1073741824 bytes
export const maxFileSizeLimitBytes = 1073741824;
export const maxFileSizeLimitAsString = "1 GB";

export const shortTimeout = 2000; // ms

// 5 minutes = 5 * 60 * 1000 ms = 300000 ms
export const uploadTimeout = 300000; // ms

const uploadNumRetries = 1;

export function detectFile(file: RcFile) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onloadstart = () => {
            // is file
            resolve(true);
        };
        reader.onerror = (e) => {
            // is directory
            resolve(false);
        };
        reader.readAsArrayBuffer(file);
    });
};

// Check if the file already exists in the file list presented in the UI
export function fileNameExists(file: RcFile, fileList: RcFile[]) {
    const duplicates = fileList.filter(
        item => item.name === file.name && item.uid !== file.uid
    );
    if (duplicates.length > 0) {
        return true;
    }
    return false;
};

// Start an upload session. Obtain the upload session id
export async function begin(
    username: string,
    password: string,
    projectNumber: string,
    subjectLabel: string,
    sessionLabel: string,
    dataType: string
) {

    const url = baseUrl() + "/upload/begin";
    const headers = new Headers(
        {
            'Content-Type': 'application/json',
            'Authorization': basicAuthString({ username, password })
        }
    );

    const body = JSON.stringify({
        projectNumber,
        subjectLabel,
        sessionLabel,
        dataType
    });

    let result: ServerResponse;
    try {
        result = await fetchRetry({
            url,
            options: {
                method: 'POST',
                credentials: 'include',
                mode: 'cors',
                headers,
                body
            } as RequestInit,
            numRetries: uploadNumRetries,
            timeout: shortTimeout
        });
    } catch (err) {
        throw err;
    }

    // Double check result for errors
    if (result.error && result.error !== "") {
        const errorMessage = result.error as string;
        throw new Error(errorMessage);
    }

    if (!result.data) {
        const errorMessage = "data is empty in result";
        throw new Error(errorMessage);
    }

    // Obtain the upload session id
    const beginResult = result.data as BeginResult;
    const uploadSessionId = beginResult.uploadSessionId as number;
    return uploadSessionId;
};

export async function initiate(
    username: string,
    password: string,
    projectNumber: string,
    subjectLabel: string,
    sessionLabel: string,
    dataType: string,
    fileList: RcFile[]
) {
    // Obtain the upload session id
    let uploadSessionId: number = -1;
    try {
        uploadSessionId = await begin(
            username,
            password,
            projectNumber,
            subjectLabel,
            sessionLabel,
            dataType);
    } catch (err) {
        throw err;
    }

    // Derive the total size of the files to be uploaded in bytes
    let totalSizeBytes: number = 0;
    fileList.forEach((file: RcFile) => {
        totalSizeBytes += file.size;
    });

    return [uploadSessionId, totalSizeBytes] as [number, number];
};

// Create form data from the upload session data and file
function getFormData(
    uploadSessionId: number,
    projectNumber: string,
    subjectLabel: string,
    sessionLabel: string,
    dataType: string,
    file: RcFile, 
    fileFieldName: string
) {
    let formData = new FormData();
    formData.append("uploadSessionId", uploadSessionId.toString());
    formData.append("projectNumber", projectNumber);
    formData.append("subjectLabel", subjectLabel);
    formData.append("sessionLabel", sessionLabel);
    formData.append("dataType", dataType);
    formData.append("filename", file.name);
    formData.append("fileSizeBytes", file.size.toString());
    formData.append(fileFieldName, file);
    return formData;
};

// Validate a single file to be uploaded
async function validateFile(
    username: string,
    password: string,
    uploadSessionId: number,
    projectNumber: string,
    subjectLabel: string,
    sessionLabel: string,
    dataType: string,
    file: RcFile
) {
    const url = baseUrl() + "/upload/validatefile";

    // Do not set Content-Type here to make it work
    // (i.e. we do not know boundary for multipart/form-data)
    const headers = new Headers(
        {
            'Authorization': basicAuthString({ username, password })
        }
    );

    const formData = getFormData(
        uploadSessionId,
        projectNumber,
        subjectLabel,
        sessionLabel,
        dataType, 
        file, 
        "validatefile");

    let result: ServerResponse;
    try {
        result = await fetchRetry({
            url,
            options: {
                method: 'POST',
                credentials: 'include',
                mode: 'cors',
                headers,
                body: formData
            } as RequestInit,
            numRetries: uploadNumRetries,
            timeout: uploadTimeout
        });
    } catch (err) {
        throw err;
    }

    // Double check result for errors
    if (result.error && result.error !== "") {
        const errorMessage = result.error as string;
        throw new Error(errorMessage);
    }

    if (!result.data) {
        const errorMessage = "data is empty in result";
        throw new Error(errorMessage);
    }

    const validateFileResult = result.data as ValidateFileResult;
    return validateFileResult;
};

// Check for existing project storage folder and existing files
export async function validate(
    username: string,
    password: string,
    uploadSessionId: number,
    projectNumber: string,
    subjectLabel: string,
    sessionLabel: string,
    dataType: string,
    fileList: RcFile[]
): Promise<ValidationResult> {

    let existingFiles = [] as string[];
    let emptyFiles = [] as string[];
    let validatedFiles = [] as ValidateFileResult[];

    for (const file of fileList) {
        const filename = file.name;

        let validateFileResult: ValidateFileResult;
        try {
            validateFileResult = await validateFile(
                username,
                password,
                uploadSessionId,
                projectNumber,
                subjectLabel,
                sessionLabel,
                dataType,
                file);
        } catch (err) {
            throw err;
        }

        // Gather existing files
        if (validateFileResult.fileExists) {
            existingFiles.push(filename);
        }

        // Gather empty files
        if (validateFileResult.fileIsEmpty) {
            emptyFiles.push(filename);
        }

        // Gather validated files
        validatedFiles.push(validateFileResult);
    }

    // Clone the arrays
    const validationResult = {
        existingFiles: [...existingFiles],
        emptyFiles: [...emptyFiles],
        validatedFiles: [...validatedFiles]
    } as ValidationResult;
    return validationResult;
};

// Add a file to be uploaded
export async function addFile(
    username: string,
    password: string,
    uploadSessionId: number,
    projectNumber: string,
    subjectLabel: string,
    sessionLabel: string,
    dataType: string,
    file: RcFile
) {
    const url = baseUrl() + "/upload/addfile";

    // Do not set Content-Type here to make it work 
    // (i.e. we do not know boundary for multipart/form-data)
    const headers = new Headers(
        {
            'Authorization': basicAuthString({ username, password })
        }
    );

    const formData = getFormData(
        uploadSessionId,
        projectNumber,
        subjectLabel,
        sessionLabel,
        dataType,  
        file, 
        "addfile");

    let result: ServerResponse;
    try {
        result = await fetchRetry({
            url,
            options: {
                method: 'POST',
                credentials: 'include',
                mode: 'cors',
                headers,
                body: formData
            } as RequestInit,
            numRetries: uploadNumRetries,
            timeout: uploadTimeout
        });
    } catch (err) {
        throw err;
    }

    // Double check result for errors
    if (result.error && result.error !== "") {
        const errorMessage = result.error as string;
        throw new Error(errorMessage);
    }

    if (!result.data) {
        const errorMessage = "data is empty in result";
        throw new Error(errorMessage);
    }

    const addFileResult = result.data as AddFileResult;
    return addFileResult;
};

// Finalize the upload session
export async function finalize(
    username: string,
    password: string,
    uploadSessionId: number,
    projectNumber: string,
    subjectLabel: string,
    sessionLabel: string,
    dataType: string
) {
    const url = baseUrl() + "/upload/finalize";
    const headers = new Headers(
        {
            'Content-Type': 'application/json',
            'Authorization': basicAuthString({ username, password })
        }
    );

    const body = JSON.stringify({
        uploadSessionId: uploadSessionId,
        projectNumber: projectNumber,
        subjectLabel: subjectLabel,
        sessionLabel: sessionLabel,
        dataType: dataType
    });

    let result: ServerResponse;
    try {
        result = await fetchRetry({
            url,
            options: {
                method: 'POST',
                credentials: 'include',
                mode: 'cors',
                headers,
                body
            } as RequestInit,
            numRetries: uploadNumRetries,
            timeout: shortTimeout
        });
    } catch (err) {
        throw err;
    }

    // Double check result for errors
    if (result.error && result.error !== "") {
        const errorMessage = result.error as string;
        throw new Error(errorMessage);
    }

    if (!result.data) {
        const errorMessage = "data is empty in result";
        throw new Error(errorMessage);
    }

    const finalizeResult = result.data as FinalizeResult;
    return finalizeResult;
};

// Finally, submit a streamer job
export async function submit(
    username: string,
    password: string,
    uploadSessionId: number,
    projectNumber: string,
    subjectLabel: string,
    sessionLabel: string,
    dataType: string
) {
    const url = baseUrl() + "/upload/submit";
    const headers = new Headers(
        {
            'Content-Type': 'application/json',
            'Authorization': basicAuthString({ username, password })
        }
    );

    const body = JSON.stringify({
        uploadSessionId: uploadSessionId,
        projectNumber: projectNumber,
        subjectLabel: subjectLabel,
        sessionLabel: sessionLabel,
        dataType: dataType
    });

    let result: ServerResponse;
    try {
        result = await fetchRetry({
            url,
            options: {
                method: 'POST',
                credentials: 'include',
                mode: 'cors',
                headers,
                body
            } as RequestInit,
            numRetries: uploadNumRetries,
            timeout: uploadTimeout
        });
    } catch (err) {
        throw err;
    }

    // Double check result for errors
    if (result.error && result.error !== "") {
        const errorMessage = result.error as string;
        throw new Error(errorMessage);
    }

    if (!result.data) {
        const errorMessage = "data is empty in result";
        throw new Error(errorMessage);
    }

    const submitResult = result.data as SubmitResult;
    return submitResult;
};

// Custom hook to initiate upload
export const useInitiateUpload = ({
    userProfile,
    uploadState,
    uploadDispatch
} : {
    userProfile: UserProfile;
    uploadState: UploadState;
    uploadDispatch: Dispatch<UploadAction>;
}) => {
    const [error, setError] = useState(null as Error | null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const initiateUpload = async () => {
            if (uploadState.status === UploadStatus.Initiating) {

                setIsLoading(true);

                const username = userProfile.username;
                const password = userProfile.password;
            
                const projectNumber = uploadState.structureSelection.projectNumberInput.value;
                const subjectLabel = uploadState.structureSelection.subjectLabelInput.value;
                const sessionLabel = uploadState.structureSelection.sessionLabelInput.value;
                const dataType = uploadState.structureSelection.dataTypeInput.value;
            
                const fileList = uploadState.filesSelection.fileList;

                try {
                    const [newUploadSessionId, newTotalSizeBytes] = await initiate(
                        username, 
                        password,
                        projectNumber,
                        subjectLabel,
                        sessionLabel,
                        dataType,
                        fileList);

                    setIsLoading(false);

                    // Initiation successful
                    return uploadDispatch({
                        type: UploadActionType.Validate,
                        payload: {
                            ...uploadState,
                            uploadSessionId: newUploadSessionId,
                            filesSelection: {
                                ...(uploadState.filesSelection),
                                totalSizeBytes: newTotalSizeBytes
                            } as FilesSelection
                        } as UploadState
                    } as UploadAction);

                } catch (err) {
                    return setError(err);
                }
            }
        };
        initiateUpload();
    }, [uploadState.status]);

    return [error, isLoading] as [Error | null, boolean];
};

// Custom hook to validate upload
export const useValidateUpload = ({
    userProfile,
    uploadState, 
    uploadDispatch
} : {
    userProfile: UserProfile;
    uploadState: UploadState;
    uploadDispatch: Dispatch<UploadAction>;
}) => {
    const [hasExistingFiles, setHasExistingFiles] = useState(false);
    const [existingFiles, setExistingFiles] = useState([] as string[]);
    const [error, setError] = useState(null as Error | null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const validateUpload = async () => {
            if (uploadState.status === UploadStatus.Validating) {
                setIsLoading(true);

                const username = userProfile.username;
                const password = userProfile.password;
            
                const uploadSessionId = uploadState.uploadSessionId;

                const projectNumber = uploadState.structureSelection.projectNumberInput.value;
                const subjectLabel = uploadState.structureSelection.subjectLabelInput.value;
                const sessionLabel = uploadState.structureSelection.sessionLabelInput.value;
                const dataType = uploadState.structureSelection.dataTypeInput.value;
            
                const fileList = uploadState.filesSelection.fileList;

                if (uploadSessionId < 0) {
                    console.log("Invalid upload session id");
                }

                try {
                    const validationResult = await validate(
                        username,
                        password,
                        uploadSessionId,
                        projectNumber,
                        subjectLabel,
                        sessionLabel,
                        dataType,
                        fileList);
                    const newExistingFiles = [...(validationResult.existingFiles)];
                    setHasExistingFiles(newExistingFiles.length > 0);
                    setExistingFiles(newExistingFiles);
                    setIsLoading(false);

                    // Validation successful
                    return uploadDispatch({
                        type: UploadActionType.Confirm,
                        payload: { ...uploadState } as UploadState
                    } as UploadAction);

                } catch (err) {
                    return setError(err);
                }
            }
        };
        validateUpload();
    }, [uploadState.status]);

    return [hasExistingFiles, existingFiles, error, isLoading] as [boolean, string[], Error | null, boolean];
};

// Custom hook to check approval
export const useCheckApproval = ({
    uploadState,
    uploadDispatch, 
    hasExistingFiles
} : {
    uploadState: UploadState;
    uploadDispatch: Dispatch<UploadAction>;
    hasExistingFiles: boolean;
}) => {
    return useEffect(() => {
        const check = async () => {
            if (uploadState.status === UploadStatus.Confirming) {
                if (!hasExistingFiles) {
                    // When the destination folder and files do not already exist,
                    // silently proceed with the actual upload
                    return uploadDispatch({
                        type: UploadActionType.Upload,
                        payload: { ...uploadState } as UploadState
                    } as UploadAction);
                }
                // Otherwise wait for user input (handled elsewhere)
            }
        };
        check();
    }, [uploadState.status]);
};

// Custom hook to handle actual upload
export const useUpload = ({
    userProfile, 
    uploadState, 
    uploadDispatch
} : {
    userProfile: UserProfile;
    uploadState: UploadState;
    uploadDispatch: Dispatch<UploadAction>;
}) => {
    const [numRemainingFiles, setNumRemainingFiles] = useState(uploadState.numRemainingFiles);
    const [percentage, setPercentage] = useState(uploadState.percentage);

    const [error, setError] = useState(null as Error | null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const upload = async () => {
            if (uploadState.status === UploadStatus.Uploading) {

                setIsLoading(true);

                const username = userProfile.username;
                const password =  userProfile.password;

                const uploadSessionId = uploadState.uploadSessionId;
            
                const projectNumber =  uploadState.structureSelection.projectNumberInput.value;
                const subjectLabel =  uploadState.structureSelection.subjectLabelInput.value;
                const sessionLabel =  uploadState.structureSelection.sessionLabelInput.value;
                const dataType =  uploadState.structureSelection.dataTypeInput.value;
            
                const fileList =  uploadState.filesSelection.fileList;
                const totalSizeBytes = uploadState.filesSelection.totalSizeBytes; 

                const numFiles = fileList.length;
                const numRemainingFiles = uploadState.numRemainingFiles;
                const percentage = uploadState.percentage;

                // Function to upload single file to streamer buffer
                const uploadFile = async ({ 
                    file, 
                    uploadSessionId, 
                    totalSizeBytes, 
                    numRemainingFiles 
                }: { 
                    file: RcFile; 
                    uploadSessionId: number; 
                    totalSizeBytes: number; 
                    numRemainingFiles: number; 
                }) => {
                    try {
                        await addFile(
                            username,
                            password,
                            uploadSessionId,
                            projectNumber,
                            subjectLabel,
                            sessionLabel,
                            dataType,
                            file);

                        // Derive percentage done
                        let newPercentage = 100;
                        if (totalSizeBytes > 0) {
                            const fileSizeBytes = file.size;
                            newPercentage = percentage + Math.floor(100.0 * fileSizeBytes / totalSizeBytes);
                        }
                        if (newPercentage < 0) newPercentage = 0;
                        if (newPercentage > 100) newPercentage = 100;
                        setPercentage(newPercentage);

                        // Derive the remaining number of files
                        let newNumRemainingFiles = numRemainingFiles - 1;
                        if (newNumRemainingFiles < 0) newNumRemainingFiles = 0;
                        if (newNumRemainingFiles > numFiles) newNumRemainingFiles = numFiles;
                        setNumRemainingFiles(newNumRemainingFiles);
                    } catch (err) {
                        throw err;
                    }
                };
    
                try {
                    // Upload files in parallel to streamer buffer
                    let uploadWork = [] as Promise<void>[];
                    fileList.forEach((file: RcFile) => {
                        uploadWork.push(uploadFile({ 
                            file, 
                            uploadSessionId, 
                            totalSizeBytes, 
                            numRemainingFiles 
                        }));
                    });
                    await Promise.all(uploadWork);

                    // Upload successful
                    return uploadDispatch({
                        type: UploadActionType.Finalize,
                        payload: {
                            ...uploadState,
                            percentage: 100,
                            numRemainingFiles: 0
                        } as UploadState
                    } as UploadAction);
                } catch (err) {
                    return setError(err);
                }
            };
        }
        upload();
    }, [uploadState.status]);

    return [numRemainingFiles, percentage, error, isLoading] as [number, number, Error | null, boolean];
};

// Custom hook to handle finalizing upload (e.g. add end time timestamp)
export const useFinalize = ({
    userProfile, 
    uploadState, 
    uploadDispatch
} : {
    userProfile: UserProfile;
    uploadState: UploadState;
    uploadDispatch: Dispatch<UploadAction>;
}) => {
    const [error, setError] = useState(null as Error | null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const endUploadSession = async () => {
            if (uploadState.status === UploadStatus.Finalizing) {
                setIsLoading(true);

                const username = userProfile.username;
                const password =  userProfile.password;

                const uploadSessionId = uploadState.uploadSessionId;
            
                const projectNumber =  uploadState.structureSelection.projectNumberInput.value;
                const subjectLabel =  uploadState.structureSelection.subjectLabelInput.value;
                const sessionLabel =  uploadState.structureSelection.sessionLabelInput.value;
                const dataType =  uploadState.structureSelection.dataTypeInput.value;
            
                try {
                    await finalize(
                        username,
                        password,
                        uploadSessionId,
                        projectNumber,
                        subjectLabel,
                        sessionLabel,
                        dataType);

                    // Finalize successful
                    return uploadDispatch({
                        type: UploadActionType.Submit,
                        payload: { ...uploadState } as UploadState
                    } as UploadAction);
                } catch (err) {
                    setError(err);
                }
            }
        };
        endUploadSession();
    }, [uploadState.status]);

    return [error, isLoading] as [Error | null, boolean];
};

// Custom hook to handle submit of streamer job
export const useSubmit = ({
    userProfile, 
    uploadState, 
    uploadDispatch
} : {
    userProfile: UserProfile;
    uploadState: UploadState;
    uploadDispatch: Dispatch<UploadAction>;
}) => {
    const [done, setDone] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]  as string[]);
    const [error, setError] = useState(null as Error | null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const submitJob = async () => {
            if (uploadState.status === UploadStatus.Submitting) {
                setIsLoading(true);
            
                const username = userProfile.username;
                const password =  userProfile.password;

                const uploadSessionId = uploadState.uploadSessionId;
            
                const projectNumber =  uploadState.structureSelection.projectNumberInput.value;
                const subjectLabel =  uploadState.structureSelection.subjectLabelInput.value;
                const sessionLabel =  uploadState.structureSelection.sessionLabelInput.value;
                const dataType =  uploadState.structureSelection.dataTypeInput.value;
            
                try {
                    // Submit a streamer job
                    const submitResult = await submit(
                        username,
                        password,
                        uploadSessionId,
                        projectNumber,
                        subjectLabel,
                        sessionLabel,
                        dataType
                    );
                    const newUploadedFiles = [...(submitResult.fileNames)];
                    setUploadedFiles(newUploadedFiles);         
                    setIsLoading(false);

                    // Submit successful
                    setDone(true);
                    return uploadDispatch({
                        type: UploadActionType.Finish,
                        payload: { ...uploadState } as UploadState
                    } as UploadAction);

                } catch (err) {
                    // Submit failed
                    setDone(true);
                    setError(err);
                    return uploadDispatch({
                        type: UploadActionType.Error,
                        payload: { ...uploadState } as UploadState
                    } as UploadAction);
                }
            }
        };
        submitJob();
    }, [uploadState.status]);

    return [done, uploadedFiles, error, isLoading] as [boolean, string[], Error | null, boolean];
};