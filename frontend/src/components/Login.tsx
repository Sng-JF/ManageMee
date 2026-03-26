import { useState } from 'react';
import svgPaths from "../imports/svg-0oc6to7v6k";
import img from "figma:asset/264bae8b22c429b55eb87dc08625934eb074fa6c.png";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [pin, setPin] = useState('');

  const handleSignIn = () => {
    // Simple mock authentication - in production would validate PIN
    if (pin.length > 0) {
      onLogin();
    }
  };

  const handleBiometric = () => {
    // Mock biometric authentication
    onLogin();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length > 0) {
      handleSignIn();
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-[#ffffff]">
      <div className="bg-white relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="bg-[#fb6b18] h-[120px] w-full flex items-center justify-center" >
          <h1 className="font-semibold text-[36px] text-white">Welcome!</h1>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center px-4">
          {/* Avatar */}
          <div className="mt-[95px] mb-[10px]">
            <div className="relative size-[100px]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="white" r="50" />
              </svg>
              <img alt="User avatar" className="absolute inset-0 block size-full rounded-full" src={img} />
            </div>
          </div>

          {/* User Name */}
          <h2 className="font-semibold text-[20px] text-[#343434] mb-[5px]">
            Wang Le Ming
          </h2>

          {/* Not you? */}
          <button className="font-semibold text-[12px] text-[#343434] mb-[19px] hover:text-orange-600 transition-colors">
            Not you?
          </button>

          {/* PIN Input */}
          <div className="w-full max-w-[327px] mb-2">
            <div className="relative">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter PIN"
                className="w-full h-[68px] px-3 border border-[#cbcbcb] rounded-[10px] font-medium text-[14px] text-[#343434] placeholder:text-[#898989] focus:outline-none focus:border-[#fb6b18] focus:ring-2 focus:ring-[#fb6b18]/20"
              />
            </div>
          </div>

          {/* Forget PIN */}
          <button className="self-start ml-[38px] font-semibold text-[12px] text-[#343434] mb-[100px] hover:text-orange-600 transition-colors">
            Forget your PIN?
          </button>

          {/* Sign In Button */}
          <button
            onClick={handleSignIn}
            className="w-[267px] h-[44px] bg-[#fb6b18] rounded-[15px] text-white font-bold text-[16px] active:bg-[#e55f15] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={pin.length === 0}
          >
            Sign In
          </button>

          {/* Biometric */}
          <button
            onClick={handleBiometric}
            className="mt-[100px] active:scale-95 transition-transform"
            aria-label="Sign in with fingerprint"
          >
            <div className="size-[80px]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 80 80">
                <path 
                  clipRule="evenodd" 
                  d={svgPaths.p3a690fc0} 
                  fill="#FB6B18" 
                  fillRule="evenodd" 
                />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
