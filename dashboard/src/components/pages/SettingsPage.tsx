import React, { Fragment, useMemo, useState } from 'react';
import { Listbox, Radio, Transition, Checkbox } from '@headlessui/react';
import { Box, Paper, Typography, Tooltip, InputNumber, Spin, message } from 'antd';
import { StopIcon, PlayIcon, CheckIcon as DoneIcon, ChevronUpDownIcon as ColumnArrowIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { QuestionCircleOutlined } from '@ant-design/icons';
import classNames from 'classnames';

import { Header } from '../layout/Header';

// --- Mock Data & Types (to be replaced by Redux state and API calls) ---
interface TrainingParams {
    data_synthesis_mode: 'low' | 'medium' | 'high';
    model_name: string;
    learning_rate: number;
    number_of_epochs: number;
    concurrency_threads: number;
    use_cuda: boolean;
    is_cot: boolean; // Chain of Thought
}

interface ModelConfig {
    provider_type: 'openai' | 'custom';
}

interface ThinkingModelConfig {
    thinking_model_name: string;
    thinking_api_key: string;
    thinking_endpoint: string;
}

const synthesisModeOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
];

const baseModelOptions = [
    { value: 'omega-base-7b-v2', label: 'Omega Base v2 (7B) - Recommended' },
    { value: 'omega-base-13b-v2', label: 'Omega Base v2 (13B) - High Performance' },
    { value: 'experimental-rwkv-5b', label: 'Experimental RWKV v5 (5B)' },
];

const EVENT = {
    SHOW_MODEL_CONFIG_MODAL: 'show_model_config_modal',
};

// Mock thinking model modal for completeness
const ThinkingModelModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-1/3">
                <h3 className="text-lg font-semibold mb-4">Configure Thinking Model</h3>
                <p className="text-gray-600 mb-4">
                    Configuration options for the Chain of Thought (CoT) model would be here.
                </p>
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

const OpenAiModelIcon = (props: React.ComponentProps<'svg'>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.91 3.52a1 1 0 00-1.82 0l-5.66 9.8a1 1 0 00.91 1.48h11.32a1 1 0 00.91-1.48l-5.66-9.8zM12 1.73l6.58 11.4a1 1 0 01-.91 1.57H6.33a1 1 0 01-.91-1.57L12 1.73zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const CustomModelIcon = (props: React.ComponentProps<'svg'>) => (
    <svg {...props} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M12 2a1 1 0 00-1 1v2.07A8.99 8.99 0 005.07 7H3a1 1 0 100 2h2.07A8.99 8.99 0 007 16.93V19a1 1 0 102 0v-2.07A8.99 8.99 0 0016.93 15H19a1 1 0 100-2h-2.07A8.99 8.99 0 0015 7.07V5a1 1 0 10-2 0v2.07A8.99 8.99 0 009.07 9H7a1 1 0 100-2h2.07A8.99 8.99 0 0011 5.07V3a1 1 0 00-1-1zm-1 9a1 1 0 10-2 0v2.07A8.99 8.99 0 0011 18.93V21a1 1 0 102 0v-2.07A8.99 8.99 0 0011 12z" clipRule="evenodd" />
    </svg>
);

// --- Main Training Configuration Component ---

export const TrainingConfiguration = ({
    baseModelOptions,
    modelConfig,
    isTraining,
    updateTrainingParams,
    trainingParams,
    status,
    handleResetProgress,
    trainSuspended,
    trainActionLoading,
    handleTrainingAction,
    setSelectedInfo,
    cudaAvailable
}: {
    baseModelOptions: { value: string; label: string }[];
    modelConfig: ModelConfig | null;
    isTraining: boolean;
    updateTrainingParams: (params: Partial<TrainingParams>) => void;
    trainingParams: TrainingParams;
    status: 'idle' | 'training' | 'trained' | 'suspended';
    handleResetProgress: () => void;
    trainSuspended: boolean;
    trainActionLoading: boolean;
    handleTrainingAction: () => void;
    setSelectedInfo: (info: boolean) => void;
    cudaAvailable: boolean;
}) => {
    const [openThinkingModel, setOpenThinkingModel] = useState<boolean>(false);
    const [showThinkingWarning, setShowThinkingWarning] = useState<boolean>(false);
    
    // In a real app, this would come from a store like Zustand or Redux
    const thinkingModelConfig: ThinkingModelConfig = {
        thinking_model_name: 'gpt-4-turbo',
        thinking_api_key: 'sk-....',
        thinking_endpoint: 'https://api.openai.com/v1'
    };

    const disabledChangeParams = useMemo(() => {
        return isTraining || trainSuspended;
    }, [isTraining, trainSuspended]);

    const thinkingConfigComplete = useMemo(() => {
        return (
            !!thinkingModelConfig.thinking_model_name &&
            !!thinkingModelConfig.thinking_api_key &&
            !!thinkingModelConfig.thinking_endpoint
        );
    }, [thinkingModelConfig]);

    const trainButtonText = useMemo(() => {
        return isTraining
            ? 'Stop Training'
            : status === 'trained'
                ? 'Retrain'
                : trainSuspended
                    ? 'Resume Training'
                    : 'Start Training';
    }, [isTraining, status, trainSuspended]);

    const trainButtonIcon = useMemo(() => {
        return isTraining ? (
            trainActionLoading ? (
                <Spin className="h-5 w-5 mr-2" />
            ) : (
                <StopIcon className="h-5 w-5 mr-2" />
            )
        ) : (
            <PlayIcon className="h-5 w-5 mr-2" />
        );
    }, [isTraining, trainActionLoading]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold tracking-tight text-gray-900">
                    Training Configuration
                </h2>
                <button
                    className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                    onClick={() => setSelectedInfo(true)}
                    title="Learn more about training process"
                >
                    <InformationCircleIcon className="w-5 h-5" />
                </button>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
                {`Configure how the Omega AI Core will be trained using your memory data and identity. Then click 'Start Training'.`}
            </p>

            <div className="space-y-6">
                <div className="flex flex-col gap-10">
                    <div className="flex flex-col gap-2">
                        <h4 className="text-base font-semibold text-gray-800 flex items-center">
                            Step 1: Choose Support Model for Data Synthesis
                        </h4>
                        {!modelConfig?.provider_type ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <label className="block text-sm font-medium text-red-500 mb-1">
                                        No Support Model for Data Synthesis Configured
                                    </label>
                                    <button
                                        className="ml-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors cursor-pointer relative z-10"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            window.dispatchEvent(new CustomEvent(EVENT.SHOW_MODEL_CONFIG_MODAL));
                                        }}
                                    >
                                        Configure Support Model
                                    </button>
                                </div>
                                <span className="text-xs text-gray-500">
                                    Model used for processing and synthesizing your memory data
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center relative w-full rounded-lg bg-white py-2 text-left">
                                <div className="flex items-center">
                                    <span className="text-sm font-medium text-gray-700">Model Used : &nbsp;</span>
                                    {modelConfig.provider_type === 'openai' ? (
                                        <OpenAiModelIcon className="h-5 w-5 mr-2 text-green-600" />
                                    ) : (
                                        <CustomModelIcon className="h-5 w-5 mr-2 text-blue-600" />
                                    )}
                                    <span className="font-medium">
                                        {modelConfig.provider_type === 'openai' ? 'OpenAI' : 'Custom Model'}
                                    </span>
                                    <button
                                        className={classNames(
                                            'ml-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors cursor-pointer relative z-10',
                                            disabledChangeParams && 'opacity-50 !cursor-not-allowed'
                                        )}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (disabledChangeParams) {
                                                message.warning('Cancel the current training to configure the model.');
                                                return;
                                            }
                                            window.dispatchEvent(new CustomEvent(EVENT.SHOW_MODEL_CONFIG_MODAL));
                                        }}
                                    >
                                        Configure Model for Data Synthesis
                                    </button>
                                </div>
                                <span className="ml-auto text-xs text-gray-500">
                                    Model used for processing and synthesizing your memory data
                                </span>
                            </div>
                        )}
                        <div className="flex flex-col gap-3">
                            <div className="font-medium">Data Synthesis Mode</div>
                            <Radio.Group
                                disabled={disabledChangeParams}
                                onChange={(e) =>
                                    updateTrainingParams({
                                        data_synthesis_mode: e.target.value
                                    })
                                }
                                value={trainingParams.data_synthesis_mode}
                                className="flex space-x-2"
                            >
                                {synthesisModeOptions.map(option => (
                                    <Radio.Option key={option.value} value={option.value} className={({ checked }) => classNames("px-4 py-2 rounded-md cursor-pointer text-sm font-medium border transition-colors", checked ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")}>
                                        {option.label}
                                    </Radio.Option>
                                ))}
                            </Radio.Group>
                            <span className="text-xs text-gray-500">
                                Low: Fast data synthesis. Medium: Balanced synthesis and speed. High: Rich synthesis, slower speed.
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-base font-semibold text-gray-800 mb-1">
                                Step 2: Choose Base Model for Training AI Core
                            </h4>
                            <span className="text-xs text-gray-500">
                                Base model for training the AI Core. Choose based on your available system resources.
                            </span>
                        </div>
                        <Listbox
                            disabled={disabledChangeParams}
                            onChange={(value) => updateTrainingParams({ model_name: value })}
                            value={trainingParams.model_name}
                        >
                            <div className="relative mt-1">
                                <Listbox.Button
                                    className={classNames(
                                        'relative w-full cursor-pointer rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-300',
                                        disabledChangeParams && 'opacity-50 !cursor-not-allowed'
                                    )}
                                >
                                    <span className="block truncate">
                                        {baseModelOptions.find((option) => option.value === trainingParams.model_name)
                                            ?.label || 'Select a model...'}
                                    </span>
                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                        <ColumnArrowIcon className="h-5 w-5 text-gray-400" />
                                    </span>
                                </Listbox.Button>
                                <Transition
                                    as={Fragment}
                                    leave="transition ease-in duration-100"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                >
                                    <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 z-[1] focus:outline-none">
                                        {baseModelOptions.map((option) => (
                                            <Listbox.Option
                                                key={option.value}
                                                className={({ active }) =>
                                                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`
                                                }
                                                value={option.value}
                                            >
                                                {({ selected }) => (
                                                    <>
                                                        <span
                                                            className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}
                                                        >
                                                            {option.label}
                                                        </span>
                                                        {selected ? (
                                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                                                <DoneIcon className="h-5 w-5" />
                                                            </span>
                                                        ) : null}
                                                    </>
                                                )}
                                            </Listbox.Option>
                                        ))}
                                    </Listbox.Options>
                                </Transition>
                            </div>
                        </Listbox>
                    </div>
                </div>
            </div>
        </div>
    );
};


const SettingsPage: React.FC = () => {
    // This component will manage the state for the TrainingConfiguration
    const [isTraining, setIsTraining] = useState(false);
    const [trainSuspended, setTrainSuspended] = useState(false);
    const [trainActionLoading, setTrainActionLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'training' | 'trained' | 'suspended'>('idle');
    const [cudaAvailable, setCudaAvailable] = useState(true); // Assume available for demo
    const [showInfo, setShowInfo] = useState(false);

    const [trainingParams, setTrainingParams] = useState<TrainingParams>({
        data_synthesis_mode: 'medium',
        model_name: 'omega-base-7b-v2',
        learning_rate: 0.0001,
        number_of_epochs: 2,
        concurrency_threads: 2,
        use_cuda: true,
        is_cot: false,
    });
    
    const [modelConfig, setModelConfig] = useState<ModelConfig | null>({ provider_type: 'custom' });

    const handleTrainingAction = () => {
        setTrainActionLoading(true);
        setTimeout(() => {
            if (isTraining) {
                setIsTraining(false);
                setStatus('idle');
            } else if (trainSuspended) {
                setIsTraining(true);
                setTrainSuspended(false);
                setStatus('training');
            } else {
                setIsTraining(true);
                setStatus('training');
            }
            setTrainActionLoading(false);
        }, 1000);
    };

    const handleResetProgress = () => {
        setIsTraining(false);
        setTrainSuspended(false);
        setStatus('idle');
    };

    return (
        <Box className="h-full flex flex-col p-4 space-y-4">
            <Header title="System Settings & AI Training" description="Configure platform behavior and manage AI Core training cycles." />
            <Paper className="card flex-grow p-6">
                <TrainingConfiguration
                    baseModelOptions={baseModelOptions}
                    modelConfig={modelConfig}
                    isTraining={isTraining}
                    updateTrainingParams={(params) => setTrainingParams(p => ({ ...p, ...params }))}
                    trainingParams={trainingParams}
                    status={status}
                    handleResetProgress={handleResetProgress}
                    trainSuspended={trainSuspended}
                    trainActionLoading={trainActionLoading}
                    handleTrainingAction={handleTrainingAction}
                    setSelectedInfo={setShowInfo}
                    cudaAvailable={cudaAvailable}
                />
            </Paper>
        </Box>
    );
};

export default SettingsPage;
