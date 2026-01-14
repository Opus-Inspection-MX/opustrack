"use client";

import { Loader2, MapPin } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GPSLocationCaptureProps {
  onLocationCapture: (location: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => void;
  label?: string;
  showAddressField?: boolean;
}

export function GPSLocationCapture({
  onLocationCapture,
  label = "Location",
  showAddressField = true,
}: GPSLocationCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{
    latitude?: number;
    longitude?: number;
  }>({});
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const captureGPS = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(coords);
        onLocationCapture({ ...coords, address });
        setLoading(false);
      },
      (error) => {
        setError(`Error: ${error.message}`);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={captureGPS}
          disabled={loading}
          className="w-full min-h-[44px]"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          <span className="ml-2">
            {loading ? "Capturing..." : "Capture GPS"}
          </span>
        </Button>
      </div>

      {location.latitude && location.longitude && (
        <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
          <div className="break-all">Lat: {location.latitude.toFixed(6)}</div>
          <div className="break-all">Lng: {location.longitude.toFixed(6)}</div>
        </div>
      )}

      {showAddressField && (
        <div>
          <Label htmlFor="address">Address/Location Name (Optional)</Label>
          <Input
            id="address"
            placeholder="e.g., Cliente ABC, Calle XYZ 123"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (location.latitude && location.longitude) {
                onLocationCapture({
                  latitude: location.latitude,
                  longitude: location.longitude,
                  address: e.target.value,
                });
              }
            }}
          />
        </div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}
