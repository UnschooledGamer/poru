import { Poru } from "../Poru";
export interface trackData {
    track: string;
    info: trackInfo;
}
export interface trackInfo {
    identifier: string;
    isSeekable: boolean;
    author: string;
    length: number;
    isStream: boolean;
    title: string;
    uri: string;
    artworkURL?: string;
    isrc?: string;
    sourceName: string;
    image?: string;
    requester?: any;
}
export declare class Track {
    track: string;
    info: trackInfo;
    constructor(data: trackData, requester?: any);
    resolve(poru: Poru): Promise<this>;
    displayThumbnail(size: ThumbnailSizes): string;
}
export type ThumbnailSizes = "default" | "mqdefault" | "hqdefault" | "maxresdefault";
