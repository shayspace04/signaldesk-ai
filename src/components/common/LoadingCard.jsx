import Skeleton from "react-loading-skeleton";

import "react-loading-skeleton/dist/skeleton.css";

export default function LoadingCard(){

    return(

        <div className="rounded-xl bg-card p-6 border border-[#EFEFEF] dark:border-[#2A2A2E]">

            <Skeleton height={35}/>

            <Skeleton count={5}/>

        </div>

    );

}
