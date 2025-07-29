"use client";
import { useState } from "react";
import Image, { type ImageProps } from "next/image";

export default function Home() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 text-white transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 font-bold text-lg">Sidebar</div>
        <ul className="space-y-2 p-4">
          <li>Home</li>
          <li>About</li>
          <li>Contact</li>
        </ul>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between bg-gray-100 p-4 shadow-md lg:hidden">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="text-gray-800"
          >
            {/* Custom Menu Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 5.25h16.5m-16.5 6h16.5m-16.5 6h16.5"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Home</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4">
          <h1 className="text-3xl font-bold underline">Hello, Next.js!</h1>
        </main>
      </div>
    </div>
  );
}
