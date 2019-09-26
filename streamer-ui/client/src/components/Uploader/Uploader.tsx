import React, { useState, useContext } from "react";
import {
    Layout,
    Row,
    Col,
    Card,
    Icon,
    Button,
    Divider,
    BackTop,
    Spin,
    notification
} from "antd";
import axios, { AxiosError, AxiosResponse, AxiosRequestConfig } from "axios";

import { AuthContext } from "../Auth/AuthContext";
import Header from "../Header/Header";
import Footer from "../Footer/Footer";
import FileSelector from "./FileSelector";
import FileList from "./FileList";
import TargetPath from "./TargetPath";
import StructureSelector from "./StructureSelector";
import { RcFile, Project, SelectOption } from "./types";

const { Content } = Layout;

const Uploader: React.FC = () => {
    const authContext = useContext(AuthContext);
    const [isLoadingProjectList, setIsLoadingProjectList] = useState(false);
    const [projectList, setProjectList] = useState([
        {
            id: 1,
            number: "3010000.01"
        }
    ] as Project[]);
    const [selectedProjectValue, setSelectedProjectValue] = useState("");
    const [selectedSubjectValue, setSelectedSubjectValue] = useState("");
    const [selectedSessionValue, setSelectedSessionValue] = useState("");
    const [selectedDataTypeValue, setSelectedDataTypeValue] = useState("");
    const [isSelectedProject, setIsSelectedProject] = useState(false);
    const [isSelectedSubject, setIsSelectedSubject] = useState(false);
    const [isSelectedSession, setIsSelectedSession] = useState(false);
    const [isSelectedDataType, setIsSelectedDataType] = useState(false);
    const [isSelectedDataTypeOther, setIsSelectedDataTypeOther] = useState(false);
    const [doneWithSelectDataType, setDoneWithSelectedDataType] = useState(false);
    const [fileList, setFileList] = useState([] as RcFile[]);
    const [fileListSummary, setFileListSummary] = useState(0);
    const [hasFilesSelected, setHasFilesSelected] = useState(false);
    const [proceed, setProceed] = useState(false);
    const antIcon = <Icon type="loading" style={{ fontSize: 24, margin: 10 }} spin />;

    const handleUploadResponse = (response: AxiosResponse) => {
        console.log(response.data);
        console.log(response.status);
        console.log(response.statusText);
        console.log(response.headers);
        console.log(response.config);
    };

    const handleUploadError = (error: AxiosError) => {
        if (error.response) {
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
        } else {
            console.log(error.message);
        }
        alert(error);
        return error;
    };

    const handleUploadRequest = (username: string, password: string, formData: any) => {
        return new Promise((resolve) => {

            const config: AxiosRequestConfig = {
                url: "/upload",
                method: "post",
                headers: { "Content-Type": "multipart/form-data" },
                data: formData,
                timeout: 10000,
                withCredentials: true,
                auth: {
                    username: username,
                    password: password
                },
                responseType: "json"
            };

            resolve(
                axios(config)
                    .then(handleUploadResponse)
                    .catch(handleUploadError));
        });
    };

    const handleUpload = (event: any) => {
        var formData = new FormData();

        // Add the attributes
        formData.append("projectNumber", selectedProjectValue);
        formData.append("subjectLabel", selectedSubjectValue);
        formData.append("sessionLabel", selectedSessionValue);
        formData.append("dataType", selectedDataTypeValue);

        // Add the files for upload
        fileList.forEach((file: any) => {
            formData.append("files", file);
        });

        handleUploadRequest(authContext!.username, authContext!.password, formData);
    };

    const openNotification = (
        title: string,
        description: string,
        category: "success" | "info" | "error" | "warning",
        duration: number,
        placement: "topLeft" | "topRight" | "bottomLeft" | "bottomRight"
    ) => {
        notification[category]({
            message: title,
            description: description,
            duration: duration,
            placement: placement
        });
    };

    const fileNameExists = (file: RcFile, fileList: RcFile[]) => {
        const duplicates = fileList.filter(
            item => item.name === file.name && item.uid !== file.uid
        );
        if (duplicates.length > 0) {
            return true;
        } else {
            return false;
        }
    };

    const handleAdd = (file: RcFile) => {
        if (fileNameExists(file, fileList)) {
            openNotification(
                "Error",
                `"${file.name}" filename already exists, please rename.`,
                "error",
                0,
                "bottomLeft"
            );
        } else {
            setHasFilesSelected(true);
            setFileList(fileList => [...fileList, file]);
            setFileListSummary(fileListSummary => fileListSummary + file.size);
            // openNotification(
            //     "Success",
            //     `"${file.name}" file successfully added to list.`,
            //     "success",
            //     4.5,
            //     "bottomLeft"
            // );
        }
    };

    const handleDelete = (uid: string, filename: string, size: number) => {
        const fileListUpdated = fileList.filter(
            (item: any) => item.name !== filename && item.uid !== uid
        );
        const hasFilesSelectedUpdated = fileListUpdated.length > 0;
        setHasFilesSelected(hasFilesSelectedUpdated);
        setFileList(fileListUpdated);
        setFileListSummary(fileListSummary => fileListSummary - size);
    };

    const handleDeleteList = () => {
        setHasFilesSelected(false);
        setFileList([] as RcFile[]);
        setFileListSummary(0);
    };

    const handleChange = (file: RcFile, fileList: RcFile[]) => {
        handleAdd(file);
        return false;
    };

    const handleSelectProjectValue = (value: SelectOption) => {
        setSelectedProjectValue(value.key);
        setIsSelectedProject(true);
        setSelectedSubjectValue("");
        setIsSelectedSubject(false);
        setSelectedSessionValue("");
        setIsSelectedSession(false);
        setSelectedDataTypeValue("");
        setIsSelectedDataType(false);
        setIsSelectedDataTypeOther(false);
        setDoneWithSelectedDataType(false);
        setProceed(false);
    };

    const regexpSubjectLabel = new RegExp("^[a-zA-Z0-9]+$");
    const validateSubjectLabelInput = (text: string) => {
        return regexpSubjectLabel.test(text);
    };

    const handleChangeSubjectLabel = (event: any) => {
        let isValid = validateSubjectLabelInput(event.target.value);
        if (isValid) {
            setSelectedSubjectValue(event.target.value);
            setIsSelectedSubject(true);
            setSelectedSessionValue("");
            setIsSelectedSession(false);
            setSelectedDataTypeValue("");
            setIsSelectedDataType(false);
            setIsSelectedDataTypeOther(false);
            setDoneWithSelectedDataType(false);
            setProceed(false);
        } else {
            let value = event.target.value;
            // Do not store invalid strings and show error.
            // Silently reset in case of empty string.
            if (value !== "") {
                value = selectedSubjectValue;
                openNotification(
                    "Error",
                    `subject label "${event.target.value}" must be of form [a-zA-Z0-9]+.`,
                    "error",
                    4.5,
                    "bottomLeft"
                );
            }
            setSelectedSubjectValue(value);
            setIsSelectedSubject(false);
            setSelectedSessionValue("");
            setIsSelectedSession(false);
            setSelectedDataTypeValue("");
            setIsSelectedDataType(false);
            setIsSelectedDataTypeOther(false);
            setDoneWithSelectedDataType(false);
            setProceed(false);
        }
    };

    const regexpSessionLabel = new RegExp("^[a-zA-Z0-9]+$");
    const validateSessionLabelInput = (text: string) => {
        return regexpSessionLabel.test(text);
    };

    const handleChangeSessionLabel = (event: any) => {
        let isValid = validateSessionLabelInput(event.target.value);
        if (isValid) {
            setSelectedSessionValue(event.target.value);
            setIsSelectedSession(true);
            setSelectedDataTypeValue("");
            setIsSelectedDataType(false);
            setIsSelectedDataTypeOther(false);
            setDoneWithSelectedDataType(false);
            setProceed(false);
        } else {
            let value = event.target.value;
            // Do not store invalid strings and show error.
            // Silently reset in case of empty string.
            if (value !== "") {
                value = selectedSessionValue;
                openNotification(
                    "Error",
                    `Session label "${event.target.value}" must be of form [a-zA-Z0-9]+.`,
                    "error",
                    4.5,
                    "bottomLeft"
                );
            }
            setSelectedSessionValue(value);
            setIsSelectedSession(false);
            setSelectedDataTypeValue("");
            setIsSelectedDataType(false);
            setIsSelectedDataTypeOther(false);
            setDoneWithSelectedDataType(false);
            setProceed(false);
        }
    };

    const handleSelectDataTypeValue = (value: SelectOption) => {
        setSelectedDataTypeValue(value.key);
        setIsSelectedDataType(true);
        setIsSelectedDataTypeOther(false);
        let proceed = true;
        if (value.key === "other") {
            setIsSelectedDataTypeOther(true);
            proceed = false;
        }
        setDoneWithSelectedDataType(proceed);
        setProceed(proceed);
    };

    const regexpSelectedDataTypeOtherInput = new RegExp("^[a-z]+$");
    const validateSelectedDataTypeOtherInput = (text: string) => {
        return regexpSelectedDataTypeOtherInput.test(text);
    };

    const handleChangeSelectedDataTypeOther = (event: any) => {
        let isValid = validateSelectedDataTypeOtherInput(event.target.value);
        if (isValid) {
            setSelectedDataTypeValue(event.target.value);
            setDoneWithSelectedDataType(true);
            setProceed(true);
        } else {
            let value = event.target.value;
            // Do not store invalid strings and show error.
            // Silently reset in case of empty string.
            if (value !== "") {
                value = selectedDataTypeValue;
                openNotification(
                    "Error",
                    `other data type "${event.target.value}" must be all lower case, with no special characters.`,
                    "error",
                    4.5,
                    "bottomLeft"
                );
            }
            setSelectedDataTypeValue(value);
            setDoneWithSelectedDataType(false);
            setProceed(false);
        }
    };

    return (
        <Content style={{ background: "#f0f2f5" }}>
            <Header />
            <div style={{ padding: 10 }}>
                <Row>
                    <Col span={12}>
                        <Card
                            style={{
                                borderRadius: 4,
                                boxShadow: "1px 1px 1px #ddd",
                                minHeight: "600px",
                                marginTop: 10
                            }}
                            className="shadow"
                        >
                            <table style={{ width: "100%" }}>
                                <tr>
                                    <td><h2>Local PC</h2></td>
                                </tr>
                            </table>
                            <Divider />
                            <FileSelector
                                fileList={fileList}
                                fileListSummary={fileListSummary}
                                hasFilesSelected={hasFilesSelected}
                                handleChange={handleChange}
                            />
                            <br />
                            <br />
                            <FileList
                                fileList={fileList}
                                fileListSummary={fileListSummary}
                                hasFilesSelected={hasFilesSelected}
                                handleDelete={handleDelete}
                                handleDeleteList={handleDeleteList}
                            />
                            <div>
                                <BackTop />
                            </div>
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card
                            style={{
                                marginLeft: 10,
                                borderRadius: 4,
                                boxShadow: "1px 1px 1px #ddd",
                                minHeight: "600px",
                                marginTop: 10
                            }}
                            className="shadow"
                        >
                            <table style={{ width: "100%" }}>
                                <tr>
                                    <td>
                                        <h2>Project storage</h2>
                                    </td>
                                    <td style={{ float: "right" }}>
                                        <TargetPath
                                            isSelectedProject={isSelectedProject}
                                            projectNumber={selectedProjectValue}
                                            isSelectedSubject={isSelectedSubject}
                                            subjectLabel={selectedSubjectValue}
                                            isSelectedSession={isSelectedSession}
                                            sessionLabel={selectedSessionValue}
                                            isSelectedDataType={isSelectedDataType}
                                            dataType={selectedDataTypeValue}
                                        />
                                    </td>
                                </tr>
                            </table>
                            <Divider />
                            {isLoadingProjectList &&
                                <Content style={{ marginTop: "10px" }}>
                                    <div>Loading projects for {authContext!.username} ...</div>
                                    <Spin indicator={antIcon} />
                                </Content>
                            }
                            {!isLoadingProjectList &&
                                <StructureSelector
                                    projectList={projectList}
                                    isSelectedProject={isSelectedProject}
                                    projectNumber={selectedProjectValue}
                                    isSelectedSubject={isSelectedSubject}
                                    subjectLabel={selectedSubjectValue}
                                    isSelectedSession={isSelectedSession}
                                    sessionLabel={selectedSessionValue}
                                    isSelectedDataType={isSelectedDataType}
                                    isSelectedDataTypeOther={isSelectedDataTypeOther}
                                    dataType={selectedDataTypeValue}
                                    handleSelectProjectValue={handleSelectProjectValue}
                                    handleChangeSubjectLabel={handleChangeSubjectLabel}
                                    handleChangeSessionLabel={handleChangeSessionLabel}
                                    handleSelectDataTypeValue={handleSelectDataTypeValue}
                                    handleChangeSelectedDataTypeOther={handleChangeSelectedDataTypeOther}
                                />
                            }
                            {isSelectedSession && hasFilesSelected && proceed && (
                                <Button
                                    size="large"
                                    style={{
                                        backgroundColor: "#52c41a",
                                        color: "#fff",
                                        width: "200px",
                                        float: "right"
                                    }}
                                    onClick={handleUpload}
                                >
                                    Upload
                                </Button>
                            )}
                            {(!hasFilesSelected || !proceed) && (
                                <Button
                                    disabled={true}
                                    size="large"
                                    style={{ width: "200px", float: "right" }}
                                >
                                    Upload
                                </Button>
                            )}
                        </Card>
                    </Col>
                </Row>
            </div>
            <Footer />
        </Content>
    );
};

export default Uploader;
