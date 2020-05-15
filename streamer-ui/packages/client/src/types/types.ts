// Get projects query element
export interface ProjectsResultElement {
    project: string;
}

// Get projects query result
export type ProjectsResult = ProjectsResultElement[];

export interface BeginResult {
    uploadSessionId: number;
    username: string;
    ipAddress: string;
    projectNumber: string;
    subjectLabel: string;
    sessionLabel: string;
    dataType: string;
    startTime: string;
}

export interface ValidateFileResult {
    filename: string;
    fileExists: boolean;
    fileIsEmpty: boolean;
}

export interface AddFileResult {
    uploadFileId: number;
}

export interface FinalizeResult {
    uploadSessionId: number;
    endTime: string;
}

export interface SubmitResult {
    uploadSessionId: number;
    fileNames: string[];
}

export interface ServerResponse {
    error: string | null;
    data: string | BeginResult | ProjectsResult | ValidateFileResult | AddFileResult | FinalizeResult | SubmitResult | null;
};

export interface ValidationResult {
    existingFiles: string[];
    emptyFiles: string[];
    validatedFiles: ValidateFileResult[];
}

export interface RcFile extends File {
    uid: string;
    readonly lastModifiedDate: Date;
    readonly webkitRelativePath: string;
}

export interface Project {
    id: number;
    projectNumber: string;
}

export interface UploadSession {
    uploadSessionId: number;
    username: string;
    ipAddress: string;
    projectNumber: string;
    subjectLabel: string;
    sessionLabel: string;
    dataType: string;
    totalSizeBytes: number;
}

export interface Structure {
    projectNumber: string;
    subjectLabel: string;
    sessionLabel: string;
    dataType: string;
}

export type SelectOption = {
    key: string;
}

export interface UploadWork {
    newTotalSizeBytes: number;
    work: Promise<unknown>[];
    uploadSessionId: number;
    uploadSession: UploadSession;
}

export declare const InputValidationStatuses: ["success", "warning", "error", "validating", ""];