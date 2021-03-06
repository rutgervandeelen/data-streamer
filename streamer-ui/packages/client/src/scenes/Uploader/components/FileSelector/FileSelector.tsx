import React from "react";
import { Icon, Upload, Tooltip } from "antd";

import { RcFile } from "../../../../types/types";

const { Dragger } = Upload;

interface FileSelectorProps {
    handleFilesSelection: (file: RcFile, fileList: RcFile[]) => boolean | PromiseLike<void>;
}

const FileSelector: React.FC<FileSelectorProps> = ({ handleFilesSelection }) => {
    return (<React.Fragment>
        <Tooltip placement="topLeft" title="Select source files to be uploaded">
            <h2>Select files to be uploaded</h2>
            <Dragger className="file-uploader" name="file" multiple={true} beforeUpload={handleFilesSelection} customRequest={() => { }} // Prevent upload traffic to server
                showUploadList={false} directory={false}>
                <p className="ant-upload-drag-icon">
                    <Icon type="inbox" />
                </p>
                <p className="ant-upload-text">
                    Click or drag files to this area
                </p>
                <p className="ant-upload-hint">Select one or more files.</p>
            </Dragger>
        </Tooltip>
    </React.Fragment>);
};

export default FileSelector;
