#[cfg(windows)]
use std::sync::LazyLock;
#[cfg(windows)]
use std::{
    mem,
    ptr::{self, NonNull},
};
#[cfg(windows)]
use winapi::{
    ctypes::c_void,
    shared::{dxgitype::DXGI_RATIONAL, guiddef::GUID, minwindef::UINT, winerror::SUCCEEDED},
    um::{
        d3d11::{
            D3D11CreateDevice, ID3D11Device, ID3D11DeviceContext, ID3D11VideoContext,
            ID3D11VideoDevice, ID3D11VideoProcessor, ID3D11VideoProcessorEnumerator,
            D3D11_CREATE_DEVICE_VIDEO_SUPPORT, D3D11_FEATURE_D3D11_OPTIONS2,
            D3D11_FEATURE_DATA_D3D11_OPTIONS2, D3D11_SDK_VERSION,
            D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE, D3D11_VIDEO_PROCESSOR_CONTENT_DESC,
            D3D11_VIDEO_USAGE_PLAYBACK_NORMAL,
        },
        d3dcommon::D3D_DRIVER_TYPE_HARDWARE,
        unknwnbase::IUnknown,
    },
    Interface,
};

#[cfg(windows)]
const NVIDIA_PPE_INTERFACE_GUID: GUID = GUID {
    Data1: 0xd43ce1b3,
    Data2: 0x1f4b,
    Data3: 0x48ac,
    Data4: [0xba, 0xee, 0xc3, 0xc2, 0x53, 0x75, 0xe6, 0xf7],
};

#[cfg(windows)]
const NVIDIA_TRUE_HDR_INTERFACE_GUID: GUID = GUID {
    Data1: 0xfdd62bb4,
    Data2: 0x620b,
    Data3: 0x4fd7,
    Data4: [0x9a, 0xb3, 0x1e, 0x59, 0xd0, 0xd5, 0x44, 0xb3],
};

#[cfg(windows)]
static GPU_VIDEO_PROCESSING_SUPPORTED: LazyLock<bool> =
    LazyLock::new(detect_gpu_video_processing_supported);
#[cfg(windows)]
static UNIFIED_MEMORY_ARCHITECTURE: LazyLock<bool> =
    LazyLock::new(detect_unified_memory_architecture);

#[cfg(windows)]
#[repr(C)]
struct NvidiaRtxSuperResolutionExtension {
    version: u32,
    method: u32,
    enable: u32,
}

#[cfg(windows)]
struct ComPtr<T> {
    ptr: NonNull<T>,
}

#[cfg(windows)]
impl<T> ComPtr<T> {
    unsafe fn from_raw(ptr: *mut T) -> Option<Self> {
        NonNull::new(ptr).map(|ptr| Self { ptr })
    }

    fn as_ptr(&self) -> *mut T {
        self.ptr.as_ptr()
    }
}

#[cfg(windows)]
impl<T> Drop for ComPtr<T> {
    fn drop(&mut self) {
        unsafe {
            (*(self.ptr.as_ptr() as *mut IUnknown)).Release();
        }
    }
}

pub fn gpu_video_processing_supported() -> bool {
    #[cfg(windows)]
    {
        *GPU_VIDEO_PROCESSING_SUPPORTED
    }
    #[cfg(not(windows))]
    {
        false
    }
}

pub fn unified_memory_architecture() -> bool {
    #[cfg(windows)]
    {
        *UNIFIED_MEMORY_ARCHITECTURE
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[cfg(windows)]
fn detect_gpu_video_processing_supported() -> bool {
    unsafe { detect_gpu_video_processing_supported_inner() }
}

#[cfg(windows)]
unsafe fn detect_gpu_video_processing_supported_inner() -> bool {
    let Some((device, device_context)) = create_d3d11_device() else {
        return false;
    };
    let Some(video_device) = query_interface::<ID3D11VideoDevice, _>(device.as_ptr()) else {
        return false;
    };
    let Some(video_context) = query_interface::<ID3D11VideoContext, _>(device_context.as_ptr())
    else {
        return false;
    };

    let frame_rate = DXGI_RATIONAL {
        Numerator: 60,
        Denominator: 1,
    };
    let content_desc = D3D11_VIDEO_PROCESSOR_CONTENT_DESC {
        InputFrameFormat: D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE,
        InputFrameRate: frame_rate,
        InputWidth: 1280,
        InputHeight: 720,
        OutputFrameRate: frame_rate,
        OutputWidth: 1920,
        OutputHeight: 1080,
        Usage: D3D11_VIDEO_USAGE_PLAYBACK_NORMAL,
    };
    let mut enumerator = ptr::null_mut::<ID3D11VideoProcessorEnumerator>();
    if !SUCCEEDED(
        (*video_device.as_ptr()).CreateVideoProcessorEnumerator(&content_desc, &mut enumerator),
    ) {
        return false;
    }
    let Some(enumerator) = ComPtr::from_raw(enumerator) else {
        return false;
    };

    let mut video_processor = ptr::null_mut::<ID3D11VideoProcessor>();
    if !SUCCEEDED((*video_device.as_ptr()).CreateVideoProcessor(
        enumerator.as_ptr(),
        0,
        &mut video_processor,
    )) {
        return false;
    }
    let Some(video_processor) = ComPtr::from_raw(video_processor) else {
        return false;
    };

    nvidia_rtx_super_resolution_supported(&video_context, &video_processor)
        || nvidia_true_hdr_supported(&video_context, &video_processor)
}

#[cfg(windows)]
fn detect_unified_memory_architecture() -> bool {
    unsafe {
        let Some((device, _)) = create_d3d11_device() else {
            return false;
        };
        let mut options: D3D11_FEATURE_DATA_D3D11_OPTIONS2 = mem::zeroed();
        SUCCEEDED((*device.as_ptr()).CheckFeatureSupport(
            D3D11_FEATURE_D3D11_OPTIONS2,
            &mut options as *mut _ as *mut c_void,
            mem::size_of::<D3D11_FEATURE_DATA_D3D11_OPTIONS2>() as UINT,
        )) && options.UnifiedMemoryArchitecture != 0
    }
}

#[cfg(windows)]
unsafe fn create_d3d11_device() -> Option<(ComPtr<ID3D11Device>, ComPtr<ID3D11DeviceContext>)> {
    let mut device = ptr::null_mut::<ID3D11Device>();
    let mut device_context = ptr::null_mut::<ID3D11DeviceContext>();
    if !SUCCEEDED(D3D11CreateDevice(
        ptr::null_mut(),
        D3D_DRIVER_TYPE_HARDWARE,
        ptr::null_mut(),
        D3D11_CREATE_DEVICE_VIDEO_SUPPORT as UINT,
        ptr::null(),
        0,
        D3D11_SDK_VERSION,
        &mut device,
        ptr::null_mut(),
        &mut device_context,
    )) {
        return None;
    }

    Some((ComPtr::from_raw(device)?, ComPtr::from_raw(device_context)?))
}

#[cfg(windows)]
unsafe fn query_interface<T: Interface, U>(source: *mut U) -> Option<ComPtr<T>> {
    let mut out = ptr::null_mut::<c_void>();
    let hr = (*(source as *mut IUnknown)).QueryInterface(&T::uuidof(), &mut out);
    if SUCCEEDED(hr) {
        ComPtr::from_raw(out as *mut T)
    } else {
        None
    }
}

#[cfg(windows)]
unsafe fn nvidia_rtx_super_resolution_supported(
    video_context: &ComPtr<ID3D11VideoContext>,
    video_processor: &ComPtr<ID3D11VideoProcessor>,
) -> bool {
    let mut extension = NvidiaRtxSuperResolutionExtension {
        version: 1,
        method: 2,
        enable: 1,
    };

    SUCCEEDED((*video_context.as_ptr()).VideoProcessorSetStreamExtension(
        video_processor.as_ptr(),
        0,
        &NVIDIA_PPE_INTERFACE_GUID,
        mem::size_of::<NvidiaRtxSuperResolutionExtension>() as UINT,
        &mut extension as *mut _ as *mut c_void,
    ))
}

#[cfg(windows)]
unsafe fn nvidia_true_hdr_supported(
    video_context: &ComPtr<ID3D11VideoContext>,
    video_processor: &ComPtr<ID3D11VideoProcessor>,
) -> bool {
    let mut supported = 0u32;

    SUCCEEDED((*video_context.as_ptr()).VideoProcessorGetStreamExtension(
        video_processor.as_ptr(),
        0,
        &NVIDIA_TRUE_HDR_INTERFACE_GUID,
        mem::size_of_val(&supported) as UINT,
        &mut supported as *mut _ as *mut c_void,
    )) && supported != 0
}
